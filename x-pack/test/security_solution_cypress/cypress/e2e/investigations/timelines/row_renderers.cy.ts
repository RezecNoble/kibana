/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { elementsOverlap } from '../../../helpers/rules';
import {
  TIMELINE_ROW_RENDERERS_DISABLE_ALL_BTN,
  TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX,
  TIMELINE_ROW_RENDERERS_SEARCHBOX,
  TIMELINE_SHOW_ROW_RENDERERS_GEAR,
  TIMELINE_ROW_RENDERERS_SURICATA_SIGNATURE,
  TIMELINE_ROW_RENDERERS_SURICATA_SIGNATURE_TOOLTIP,
  TIMELINE_ROW_RENDERERS_SURICATA_LINK_TOOLTIP,
} from '../../../screens/timeline';
import { cleanKibana, deleteTimelines, waitForWelcomePanelToBeLoaded } from '../../../tasks/common';
import { waitForAllHostsToBeLoaded } from '../../../tasks/hosts/all_hosts';

import { login } from '../../../tasks/login';
import { visitWithTimeRange } from '../../../tasks/navigation';
import { openTimelineUsingToggle } from '../../../tasks/security_main';
import { populateTimeline } from '../../../tasks/timeline';

import { hostsUrl } from '../../../urls/navigation';

describe('Row renderers', { tags: ['@ess', '@serverless'] }, () => {
  before(() => {
    cleanKibana();
  });

  beforeEach(() => {
    deleteTimelines();
    login();
    visitWithTimeRange(hostsUrl('allHosts'), {
      onLoad: () => {
        waitForWelcomePanelToBeLoaded();
        waitForAllHostsToBeLoaded();
      },
    });
    openTimelineUsingToggle();
    populateTimeline();
    cy.get(TIMELINE_SHOW_ROW_RENDERERS_GEAR).should('exist');
    cy.get(TIMELINE_SHOW_ROW_RENDERERS_GEAR).first().click({ force: true });
  });

  it('Row renderers should be enabled by default', () => {
    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).should('exist');
    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).should('be.checked');
  });

  it('Selected renderer can be disabled and enabled', () => {
    cy.get(TIMELINE_ROW_RENDERERS_SEARCHBOX).should('exist');
    cy.get(TIMELINE_ROW_RENDERERS_SEARCHBOX).type('flow');

    // Intercepts should be before click handlers that activate them rather than afterwards or you have race conditions
    cy.intercept('PATCH', '/api/timeline', (req) => {
      if (req.body.timeline.excludedRowRendererIds.includes('netflow')) {
        req.alias = 'excludedNetflow';
      } else {
        req.alias = 'includedNetflow';
      }
    });
    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).first().uncheck();

    cy.wait('@excludedNetflow').then((interception) => {
      expect(
        interception?.response?.body.data.persistTimeline.timeline.excludedRowRendererIds
      ).to.contain('netflow');
    });

    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).first().check();

    cy.wait('@includedNetflow').then((interception) => {
      expect(
        interception?.response?.body.data.persistTimeline.timeline.excludedRowRendererIds
      ).not.to.contain('netflow');
    });
  });

  it('Selected renderer can be disabled with one click', () => {
    // Ensure these elements are visible before continuing since sometimes it takes a second for the modal to show up
    // and it gives the click handlers a bit of time to be initialized as well to reduce chances of flake but you still
    // have to use pipe() below as an additional measure.
    cy.get(TIMELINE_ROW_RENDERERS_DISABLE_ALL_BTN).should('exist');
    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).should('be.checked');

    // Intercepts should be before click handlers that activate them rather than afterwards or you have race conditions
    cy.intercept('PATCH', '/api/timeline').as('updateTimeline');

    // Keep clicking on the disable all button until the first element of all the elements are no longer checked.
    // In cases where the click handler is not present on the page just yet, this will cause the button to be clicked
    // multiple times until it sees that the click took effect. You could go through the whole list but I just check
    // for the first to be unchecked and then assume the click was successful
    cy.get(TIMELINE_ROW_RENDERERS_DISABLE_ALL_BTN).click();

    cy.get(TIMELINE_ROW_RENDERERS_MODAL_ITEMS_CHECKBOX).first().should('not.be.checked');

    cy.wait('@updateTimeline').its('response.statusCode').should('eq', 200);
  });

  describe('Suricata', () => {
    // This test has become very flaky over time and was blocking a lot of PRs.
    // A follw-up ticket to tackle this issue has been created.
    it.skip('Signature tooltips do not overlap', () => {
      // Hover the signature to show the tooltips
      cy.get(TIMELINE_ROW_RENDERERS_SURICATA_SIGNATURE).parents('.euiPopover__anchor').realHover();

      cy.get(TIMELINE_ROW_RENDERERS_SURICATA_LINK_TOOLTIP).then(($googleLinkTooltip) => {
        cy.get(TIMELINE_ROW_RENDERERS_SURICATA_SIGNATURE_TOOLTIP).then(($signatureTooltip) => {
          expect(
            elementsOverlap($googleLinkTooltip, $signatureTooltip),
            'tooltips do not overlap'
          ).to.equal(false);
        });
      });
    });
  });
});
