/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { cleanKibana } from '../../../tasks/common';
import {
  navigateToHostRiskDetailTab,
  openRiskTableFilterAndSelectTheCriticalOption,
  removeCriticalFilterAndCloseRiskTableFilter,
  selectFiveItemsPerPageOption,
} from '../../../tasks/host_risk';
import {
  HOST_BY_RISK_TABLE_CELL,
  HOST_BY_RISK_TABLE_HOSTNAME_CELL,
  HOST_BY_RISK_TABLE_NEXT_PAGE_BUTTON,
} from '../../../screens/hosts/host_risk';
import { login } from '../../../tasks/login';
import { visit } from '../../../tasks/navigation';
import { hostsUrl } from '../../../urls/navigation';
import { clearSearchBar, kqlSearch } from '../../../tasks/security_header';

// Tracked by https://github.com/elastic/security-team/issues/7696
describe.skip('risk tab', { tags: ['@ess', '@brokenInServerless'] }, () => {
  before(() => {
    cleanKibana();
    cy.task('esArchiverLoad', { archiveName: 'risk_hosts' });
  });

  beforeEach(() => {
    login();
    visit(hostsUrl('allHosts'));
    navigateToHostRiskDetailTab();
  });

  after(() => {
    cy.task('esArchiverUnload', 'risk_hosts');
  });

  it('renders the table', () => {
    kqlSearch('host.name: "siem-kibana" {enter}');
    cy.get(HOST_BY_RISK_TABLE_CELL).eq(3).should('have.text', 'siem-kibana');
    cy.get(HOST_BY_RISK_TABLE_CELL).eq(4).should('have.text', '21');
    cy.get(HOST_BY_RISK_TABLE_CELL).eq(5).should('have.text', 'Low');
    clearSearchBar();
  });

  it.skip('filters the table', () => {
    openRiskTableFilterAndSelectTheCriticalOption();

    cy.get(HOST_BY_RISK_TABLE_CELL).eq(3).should('not.have.text', 'siem-kibana');

    removeCriticalFilterAndCloseRiskTableFilter();
  });

  // Flaky
  it.skip('should be able to change items count per page', () => {
    selectFiveItemsPerPageOption();

    cy.get(HOST_BY_RISK_TABLE_HOSTNAME_CELL).should('have.length', 5);
  });

  it('should not allow page change when page is empty', () => {
    kqlSearch('host.name: "nonexistent_host" {enter}');
    cy.get(HOST_BY_RISK_TABLE_NEXT_PAGE_BUTTON).should(`not.exist`);
    clearSearchBar();
  });
});
