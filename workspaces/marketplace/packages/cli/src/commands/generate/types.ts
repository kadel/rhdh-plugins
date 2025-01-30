/*
 * Copyright Red Hat, Inc.
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

/**
 * Structure of the container registry index file that is used as input for the
 * generate command when you want to read the packages from images
 */
export interface ContainerRegistryIndex {
  plugins: PluginRecord[];
}

export interface PluginRecord {
  image: string;
  title: string;
  description: string;
}

export interface ImageInfo {
  registry: string;
  image: string;
  tag: string;
}

interface LayerInfo {
  mediaType: string;
  digest: string;
  size: number;
}

export interface ImageMetadata {
  schemaVersion: number;
  config: LayerInfo;
  layers: LayerInfo[];
  annotations: {
    [key: string]: string;
  };
}

/**
 * Data saved in the annotation 'io.backstage.dynamic-packages' of the image with the dynamic plugin
 * when generated with janus-idp/cli package-dynamic-plugins command
 */
export type DynamicPackagesInfo = AnnotationPackageInfo[];

export interface AnnotationPackageInfo {
  [key: string]: PackageMetadata;
}

export interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  backstage: PluginBackstage;
  homepage: string;
  repository: PackageRepository;
  license: string;
  maintainers: string;
  author: string;
  bugs: string;
  keywords: string[];
}

export interface PackageRepository {
  type: string;
  url: string;
  directory: string;
}

export interface PluginBackstage {
  role: string;
  'supported-versions': string;
  pluginId: string;
  pluginPackage: string;
}

/**
 * Common information about packages, this is used as an input for generating  Package catalog entities
 */
export interface PackageInfo extends PackageMetadata {
  dynamicArtifact: string;
}
