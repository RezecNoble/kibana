/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { CoreSetup, Plugin, PluginInitializerContext } from '@kbn/core/public';
import { TriggersAndActionsUIPublicPluginSetup } from '@kbn/triggers-actions-ui-plugin/public';
import { ActionsPublicPluginSetup } from '@kbn/actions-plugin/public';
import { registerConnectorTypes } from './connector_types';
import { ExperimentalFeaturesService } from './common/experimental_features_service';
import {
  ExperimentalFeatures,
  parseExperimentalConfigValue,
} from '../common/experimental_features';
import { StackConnectorsConfigType } from '../common/types';

export type Setup = void;
export type Start = void;

export interface StackConnectorsPublicSetupDeps {
  triggersActionsUi: TriggersAndActionsUIPublicPluginSetup;
  actions: ActionsPublicPluginSetup;
}

export class StackConnectorsPublicPlugin
  implements Plugin<Setup, Start, StackConnectorsPublicSetupDeps>
{
  private config: StackConnectorsConfigType;
  readonly experimentalFeatures: ExperimentalFeatures;

  constructor(ctx: PluginInitializerContext) {
    this.config = ctx.config.get();
    this.experimentalFeatures = parseExperimentalConfigValue(this.config.enableExperimental || []);
  }
  public setup(core: CoreSetup, { triggersActionsUi, actions }: StackConnectorsPublicSetupDeps) {
    registerConnectorTypes({
      connectorTypeRegistry: triggersActionsUi.actionTypeRegistry,
      services: {
        validateEmailAddresses: actions.validateEmailAddresses,
      },
    });
    ExperimentalFeaturesService.init({ experimentalFeatures: this.experimentalFeatures });
  }

  public start() {}
  public stop() {}
}
