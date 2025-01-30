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

import fs from 'fs-extra';
import { OptionValues } from 'commander';
import path from 'path';
import yaml from 'js-yaml';
import { PackageMetadata, PackageInfo } from './types';
import {
  MARKETPLACE_API_VERSION,
  MarketplaceKinds,
  MarketplacePackage,
} from '@red-hat-developer-hub/backstage-plugin-marketplace-common';
import { LocationEntityV1alpha1 } from '@backstage/catalog-model';

const DEFAULT_LIFECYCLE = 'production';
const DEFAULT_TYPE = 'plugin';

export default async (opts: OptionValues) => {
  const {
    // containerIndex,
    defaultDynamicPlugins,
    outputDir,
    namespace,
    owner,
  } = opts as {
    // containerIndex?: string;
    defaultDynamicPlugins?: string;
    outputDir?: string;
    namespace?: string;
    owner?: string;
  };

  const entities: MarketplacePackage[] = [];
  const packages: PackageMetadata[] = [];

  // TOOD: add later once we have stable image annoation structure
  // if (containerIndex) {
  //   const indexFilePath = path.resolve(containerIndex);
  //   const indexFileContent = await fs.readFile(indexFilePath, 'utf8');

  //   // parse yaml file
  //   const registryIndex: ContainerRegistryIndex = yaml.load(
  //     indexFileContent,
  //   ) as ContainerRegistryIndex;

  //   for (const plugin of registryIndex.plugins) {
  //     packages.push(...await getPackageDataFromImage(plugin.image))
  //   }
  // }

  if (defaultDynamicPlugins) {
    const defaultDynamicPluginsPath = path.resolve(defaultDynamicPlugins);
    // list all directories in the path, make sure to use only directories
    const files = await fs.readdir(defaultDynamicPluginsPath, {
      withFileTypes: true,
    });
    for (const file of files) {
      if (file.isDirectory()) {
        const packageJSONPath = path.join(
          defaultDynamicPluginsPath,
          file.name,
          'package.json',
        );
        const packageJSON = (await fs.readJson(packageJSONPath)) as PackageInfo;

        packages.push(packageJSON);
      }
    }
  }

  for (const pkg of packages) {
    console.log(pkg);

    const partOf = pkg.backstage.pluginId || undefined;

    // if package id plugin module, attach it to the parent plugin
    // this doesn't work , for example using this rule with
    // https://github.com/redhat-developer/rhdh/blob/main/dynamic-plugins/wrappers/roadiehq-scaffolder-backend-module-utils-dynamic/package.json#L14C18-L14C28
    // it will result into a partOf: utils
    // if (pkg.backstage.role === 'backend-plugin-module') {
    //   const parts = pkg.name.split('-module-');
    //   if (parts.length === 2) {
    //     partOf = parts[1];
    //   }
    // }

    const entity: MarketplacePackage = {
      apiVersion: MARKETPLACE_API_VERSION,
      kind: MarketplaceKinds.package,
      metadata: {
        name: entityName(pkg.name),
        namespace: namespace,
        title: pkg.name,
        // description:
        links: [
          {
            url: pkg.homepage,
            title: 'Plugin Homepage',
          },
          {
            url: pkg.repository.url,
            title: 'Plugin Repository',
          },
          {
            url: pkg.bugs,
            title: 'Report Issues',
          },
        ],
      },
      spec: {
        type: DEFAULT_TYPE,
        lifecycle: DEFAULT_LIFECYCLE,
        owner: owner,
        packageName: pkg.name,
        version: pkg.version,
        // dynamicArtifact: `oci://${plugin.image}`,
        backstage: {
          role: pkg.backstage.role,
          'supported-versions': pkg.backstage['supported-versions'],
        },
        partOf: partOf,
      },
    };
    entities.push(entity);
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

/**
 * Convert a given string into a valid entity name
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

/**
 * Guess the correct package name from the dependencies list of a wrapper
 */

function guessPackageFromDependencies(
  pkgname: string,
  dependencies: string[],
): string | undefined {
  if (dependencies.length === 1) {
    return dependencies[0];
  }
  for (const dep of dependencies) {
    const convertedName = pkgname.replaceAll('/', '-').replaceAll('@', '');
    if (dep.includes(convertedName)) {
      return dep;
    }
  }
  return undefined;
}
