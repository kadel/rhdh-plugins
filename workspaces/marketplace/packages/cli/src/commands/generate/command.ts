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
import { LocationEntityV1alpha1 } from '@backstage/catalog-model';

const exec = promisify(execFile);

const DEFAULT_OWNER = 'system/rhdh';
const DEFAULT_LIFECYCLE = 'production';
const DEFAULT_TYPE = 'plugin';

export default async (opts: OptionValues) => {
  const { indexFile, outputDir } = opts as {
    indexFile: string;
    outputDir?: string;
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
              name: entityName(key),
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
                  name: `oci://${plugin.image}`,
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

  if (outputDir) {
    const outputDirPath = path.resolve(outputDir);
    await fs.ensureDir(outputDirPath);

    const location: LocationEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Location',
      metadata: {
        name: 'plugins',
      },
      spec: {
        targets: [],
      },
    };

    for (const entity of entities) {
      const filename = `${entity.metadata.name}.yaml`;
      const entityPath = path.join(outputDirPath, filename);
      await fs.writeFile(entityPath, yaml.dump(entity));
      location.spec.targets?.push(filename);
    }
    await fs.writeFile(
      path.join(outputDirPath, 'all.yaml'),
      yaml.dump(location),
    );
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

/**
 * Converts a given string into a valid entity name
 */
function entityName(str: string): string {
  let name = str
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-') // Replace invalid characters with '-'
    .replace(/^-+|-+$/g, '') // Remove leading and trailing '-'
    .replace(/-+/g, '-'); // Replace multiple '-' with a single '-'

  if (name.length > 63) {
    name = name.substring(0, 63);
  }

  return name;
}
