/*
 * Copyright The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import chalk from 'chalk';
import fs from 'fs-extra';
import { OptionValues } from 'commander';
import path from 'path';
import { ExitCodeError } from '../../lib/errors';
import { promisify } from 'util';
import { execFile } from 'child_process';
import yaml from 'js-yaml';
import {
  ImageInfo,
  ImageMetadata,
  RegistryIndex,
  PluginRegistryMetadata,
} from './types';
import {
  MarketplacePlugin,
  MARKETPLACE_API_VERSION,
  MarketplaceKinds,
} from '@red-hat-developer-hub/backstage-plugin-marketplace-common';

const exec = promisify(execFile);

const DEFAULT_OWNER = 'system/rhdh';
const DEFAULT_LIFECYCLE = 'production';
const DEFAULT_TYPE = 'plugin';

export default async (opts: OptionValues) => {
  const { indexFile, outputDirectory } = opts as {
    indexFile: string;
    outputDirectory?: string;
  };

  const containerTool = 'skopeo';

  try {
    await exec(containerTool, ['--version']);
  } catch {
    console.error(
      chalk.red(
        `The provided container tool (${containerTool}) is not installed, please install it.`,
      ),
    );
    throw new ExitCodeError(1);
  }

  const indexFilePath = path.resolve(indexFile);
  const indexFileContent = await fs.readFile(indexFilePath, 'utf8');

  // parse yaml file
  const registryIndex: RegistryIndex = yaml.load(
    indexFileContent,
  ) as RegistryIndex;

  const entities: MarketplacePlugin[] = [];

  for (const plugin of registryIndex.plugins) {
    const image = parseImage(plugin.image);
    const meta = await inspectImage(containerTool, image);

    const dynamiPackageAnnotationValue =
      meta?.annotations['io.backstage.dynamic-packages'] || '';
    if (!dynamiPackageAnnotationValue) {
      console.log(`No dynamic packages found in image ${plugin.image}`);
      continue;
    }

    const decodedValue = Buffer.from(
      dynamiPackageAnnotationValue,
      'base64',
    ).toString('utf8');
    const dynamicPackages: PluginRegistryMetadata = JSON.parse(decodedValue);

    for (const packageInfo of dynamicPackages) {
      for (const key in packageInfo) {
        if (Object.hasOwn(packageInfo, key)) {
          const data = packageInfo[key];

          entities.push({
            apiVersion: MARKETPLACE_API_VERSION,
            kind: MarketplaceKinds.plugin,
            metadata: {
              name: data.name,
              title: plugin.title,
              description: plugin.description,
              links: [
                {
                  url: data.homepage,
                  title: 'Plugin Homepage',
                },
                {
                  url: data.repository.url,
                  title: 'Plugin Repository',
                },
                {
                  url: data.bugs,
                  title: 'Report Issues',
                },
              ],
            },
            spec: {
              type: DEFAULT_TYPE,
              lifecycle: DEFAULT_LIFECYCLE,
              owner: DEFAULT_OWNER,
              packages: [
                {
                  name: data.name,
                  version: data.version,
                  backstage: {
                    role: data.backstage.role,
                    'supported-versions': data.backstage['supported-versions'],
                  },
                },
              ],
            },
          });
        }
      }
    }
  }

  if (outputDirectory) {
    const outputDirPath = path.resolve(outputDirectory);
    await fs.ensureDir(outputDirPath);

    for (const entity of entities) {
      const entityPath = path.join(
        outputDirPath,
        `${entity.metadata.name}.yaml`,
      );
      await fs.writeFile(entityPath, yaml.dump(entity));
    }
  } else {
    for (const entity of entities) {
      console.log(yaml.dump(entity));
      console.log('---');
    }
  }
};

function parseImage(imagePath: string): ImageInfo {
  // TODO: validate imagePath
  const parts = imagePath.split('/');
  const registry = parts[0];
  const imageParts = parts.slice(1).join('/').split(':');
  const image = imageParts[0];
  const tag = imageParts[1];
  return { registry, image, tag };
}

async function inspectImage(
  containerTool: string,
  image: ImageInfo,
): Promise<ImageMetadata | undefined> {
  try {
    const { stdout } = await exec(containerTool, [
      'inspect',
      '--raw',
      `docker://${image.registry}/${image.image}:${image.tag}`,
    ]);
    return JSON.parse(stdout) as ImageMetadata;
  } catch (e) {
    console.error(
      chalk.red(`Error encountered while inspecting plugin container: ${e}`),
    );
    return undefined;
  }
}
