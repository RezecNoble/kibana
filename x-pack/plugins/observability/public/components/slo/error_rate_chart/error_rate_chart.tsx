/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ViewMode } from '@kbn/embeddable-plugin/public';
import { SLOResponse } from '@kbn/slo-schema';
import moment from 'moment';
import React from 'react';
import { useKibana } from '../../../utils/kibana_react';
import { useLensDefinition } from './use_lens_definition';

interface Props {
  slo: SLOResponse;
  fromRange: Date;
}

export function ErrorRateChart({ slo, fromRange }: Props) {
  const {
    lens: { EmbeddableComponent },
  } = useKibana().services;
  const lensDef = useLensDefinition(slo);

  return (
    <EmbeddableComponent
      id="sloErrorRateChart"
      style={{ height: 190 }}
      timeRange={{
        from: fromRange.toISOString(),
        to: moment().toISOString(),
      }}
      attributes={lensDef}
      viewMode={ViewMode.VIEW}
      noPadding
    />
  );
}
