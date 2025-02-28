/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EsQueryRuleParams } from './rule_type_params';

export function isEsQueryRule(searchType: EsQueryRuleParams['searchType']) {
  return searchType === 'esQuery';
}

export function isSearchSourceRule(searchType: EsQueryRuleParams['searchType']) {
  return searchType === 'searchSource';
}

export function isEsqlQueryRule(searchType: EsQueryRuleParams['searchType']) {
  return searchType === 'esqlQuery';
}
