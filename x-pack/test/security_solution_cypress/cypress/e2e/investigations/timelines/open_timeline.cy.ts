/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getTimeline } from '../../../objects/timeline';

import {
  TIMELINE_DESCRIPTION,
  TIMELINE_TITLE,
  OPEN_TIMELINE_MODAL,
} from '../../../screens/timeline';
import {
  TIMELINES_DESCRIPTION,
  TIMELINES_PINNED_EVENT_COUNT,
  TIMELINES_NOTES_COUNT,
  TIMELINES_FAVORITE,
} from '../../../screens/timelines';
import { addNoteToTimeline } from '../../../tasks/api_calls/notes';

import { createTimeline } from '../../../tasks/api_calls/timelines';

import { cleanKibana } from '../../../tasks/common';

import { login } from '../../../tasks/login';
import { visit } from '../../../tasks/navigation';
import {
  markAsFavorite,
  openTimelineById,
  openTimelineFromSettings,
  pinFirstEvent,
  refreshTimelinesUntilTimeLinePresent,
} from '../../../tasks/timeline';

import { TIMELINES_URL } from '../../../urls/navigation';

describe('Open timeline', { tags: ['@brokenInServerless', '@ess'] }, () => {
  describe('Open timeline modal', () => {
    before(function () {
      cleanKibana();
      login();
      visit(TIMELINES_URL);

      createTimeline(getTimeline())
        .then((response) => response.body.data.persistTimeline.timeline.savedObjectId)
        .then((timelineId: string) => {
          refreshTimelinesUntilTimeLinePresent(timelineId)
            // This cy.wait is here because we cannot do a pipe on a timeline as that will introduce multiple URL
            // request responses and indeterminism since on clicks to activates URL's.
            .then(() => cy.wrap(timelineId).as('timelineId'))
            // eslint-disable-next-line cypress/no-unnecessary-waiting
            .then(() => cy.wait(1000))
            .then(() =>
              addNoteToTimeline(getTimeline().notes, timelineId).should((response) =>
                expect(response.status).to.equal(200)
              )
            )
            .then(() => openTimelineById(timelineId))
            .then(() => pinFirstEvent())
            .then(() => markAsFavorite());
        });
    });

    beforeEach(function () {
      login();
      visit(TIMELINES_URL);
      openTimelineFromSettings();
      openTimelineById(this.timelineId);
    });

    it('should open a modal', () => {
      cy.get(OPEN_TIMELINE_MODAL).should('be.visible');
    });

    it('should display timeline info - title', () => {
      cy.contains(getTimeline().title).should('exist');
    });

    it('should display timeline info - description', () => {
      cy.get(TIMELINES_DESCRIPTION).last().should('have.text', getTimeline().description);
    });

    it('should display timeline info - pinned event count', () => {
      cy.get(TIMELINES_PINNED_EVENT_COUNT).last().should('have.text', '1');
    });

    it('should display timeline info - notes count', () => {
      cy.get(TIMELINES_NOTES_COUNT).last().should('have.text', '1');
    });

    it('should display timeline info - favorite timeline', () => {
      cy.get(TIMELINES_FAVORITE).last().should('exist');
    });

    it('should display timeline content - title', () => {
      cy.get(TIMELINE_TITLE).should('have.text', getTimeline().title);
    });

    it('should display timeline content - description', () => {
      cy.get(TIMELINE_DESCRIPTION).should('have.text', getTimeline().description);
    });
  });
});
