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

export interface PluginRecord {
  image: string;
  title: string;
  description: string;
}

export interface RegistryIndex {
  plugins: PluginRecord[];
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

// from image
export type PluginRegistryMetadata = PluginInfo[];

export interface PluginInfo {
  [key: string]: PluginMetadata;
}

export interface PluginRepository {
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

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  backstage: PluginBackstage;
  homepage: string;
  repository: PluginRepository;
  license: string;
  maintainers: string;
  author: string;
  bugs: string;
  keywords: string[];
}
