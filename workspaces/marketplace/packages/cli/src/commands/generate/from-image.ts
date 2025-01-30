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

import {
  ImageInfo,
  ImageMetadata,
  DynamicPackagesInfo,
  PackageMetadata,
} from './types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ExitCodeError } from '../../lib/errors';

const exec = promisify(execFile);

const containerTool = 'skopeo';

/**
 * Get the dynamic packages data information from the image annotation
 */
export async function getPackageData(
  image: string,
): Promise<PackageMetadata[]> {
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

  const parsedImage = parseImage(image);
  const meta = await inspectImage(parsedImage);

  const dynamiPackageAnnotationValue =
    meta?.annotations['io.backstage.dynamic-packages'] || '';
  if (!dynamiPackageAnnotationValue) {
    throw new Error(`No dynamic packages found in image ${image}`);
  }

  const decodedValue = Buffer.from(
    dynamiPackageAnnotationValue,
    'base64',
  ).toString('utf8');
  const dynamicPackages: DynamicPackagesInfo = JSON.parse(decodedValue);
  const packages: PackageMetadata[] = [];

  for (const dynamicPackage of dynamicPackages) {
    const packageMetadata = Object.values(dynamicPackage)[0];
    packages.push(packageMetadata);
  }

  return packages;
}

function parseImage(imagePath: string): ImageInfo {
  // TODO: validate imagePath
  const parts = imagePath.split('/');
  const registry = parts[0];
  const imageParts = parts.slice(1).join('/').split(':');
  const image = imageParts[0];
  const tag = imageParts[1];
  return { registry, image, tag };
}

async function inspectImage(image: ImageInfo): Promise<ImageMetadata> {
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
    throw new ExitCodeError(1);
  }
}
