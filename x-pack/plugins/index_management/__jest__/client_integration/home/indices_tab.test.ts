/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from 'react-dom/test-utils';

import { API_BASE_PATH, INTERNAL_API_BASE_PATH } from '../../../common';
import { setupEnvironment, nextTick } from '../helpers';
import { IndicesTestBed, setup } from './indices_tab.helpers';
import { createDataStreamPayload, createNonDataStreamIndex } from './data_streams_tab.helpers';

// Since the editor component being used for editing index settings is not a React
// component but an editor being instantiated on a div reference, we cannot mock
// the component and replace it with something else. In this particular case we're
// mocking the returned instance of the editor to always have the same values.
const mockGetAceEditorValue = jest.fn().mockReturnValue(`{}`);

jest.mock('../../../public/application/lib/ace', () => {
  const createAceEditor = () => {
    return {
      getValue: mockGetAceEditorValue,
      getSession: () => {
        return {
          on: () => null,
          getValue: () => null,
        };
      },
      destroy: () => null,
    };
  };

  return {
    createAceEditor,
  };
});

/**
 * The below import is required to avoid a console error warn from the "brace" package
 * console.warn ../node_modules/brace/index.js:3999
      Could not load worker ReferenceError: Worker is not defined
          at createWorker (/<path-to-repo>/node_modules/brace/index.js:17992:5)
 */
import { stubWebWorker } from '@kbn/test-jest-helpers';
import { createMemoryHistory } from 'history';
import {
  breadcrumbService,
  IndexManagementBreadcrumb,
} from '../../../public/application/services/breadcrumbs';
stubWebWorker();

describe('<IndexManagementHome />', () => {
  let testBed: IndicesTestBed;
  let httpSetup: ReturnType<typeof setupEnvironment>['httpSetup'];
  let httpRequestsMockHelpers: ReturnType<typeof setupEnvironment>['httpRequestsMockHelpers'];
  jest.spyOn(breadcrumbService, 'setBreadcrumbs');

  beforeEach(() => {
    const mockEnvironment = setupEnvironment();
    httpRequestsMockHelpers = mockEnvironment.httpRequestsMockHelpers;
    httpSetup = mockEnvironment.httpSetup;
  });

  describe('on component mount', () => {
    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([]);

      await act(async () => {
        testBed = await setup(httpSetup);
      });

      const { component } = testBed;

      component.update();
    });

    test('updates the breadcrumbs to indices', () => {
      expect(breadcrumbService.setBreadcrumbs).toHaveBeenLastCalledWith(
        IndexManagementBreadcrumb.indices
      );
    });

    test('toggles the include hidden button through URL hash correctly', () => {
      const { actions } = testBed;
      expect(actions.getIncludeHiddenIndicesToggleStatus()).toBe(true);
      actions.clickIncludeHiddenIndicesToggle();
      expect(actions.getIncludeHiddenIndicesToggleStatus()).toBe(false);
      // Note: this test modifies the shared location.hash state, we put it back the way it was
      actions.clickIncludeHiddenIndicesToggle();
      expect(actions.getIncludeHiddenIndicesToggleStatus()).toBe(true);
    });
  });

  describe('data stream column', () => {
    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([
        {
          health: '',
          status: '',
          primary: '',
          replica: '',
          documents: '',
          documents_deleted: '',
          size: '',
          primary_size: '',
          name: 'data-stream-index',
          data_stream: 'dataStream1',
        },
        {
          health: '',
          status: '',
          primary: '',
          replica: '',
          documents: '',
          documents_deleted: '',
          size: '',
          primary_size: '',
          name: 'no-data-stream-index',
          data_stream: null,
        },
      ]);

      // The detail panel should still appear even if there are no data streams.
      httpRequestsMockHelpers.setLoadDataStreamsResponse([]);

      httpRequestsMockHelpers.setLoadDataStreamResponse(
        'dataStream1',
        createDataStreamPayload({ name: 'dataStream1' })
      );

      testBed = await setup(httpSetup, {
        history: createMemoryHistory(),
      });

      await act(async () => {
        const { component } = testBed;

        await nextTick();
        component.update();
      });
    });

    test('navigates to the data stream in the Data Streams tab', async () => {
      const {
        findDataStreamDetailPanel,
        findDataStreamDetailPanelTitle,
        actions: { clickDataStreamAt, dataStreamLinkExistsAt },
      } = testBed;

      expect(dataStreamLinkExistsAt(0)).toBeTruthy();
      await clickDataStreamAt(0);

      expect(findDataStreamDetailPanel().length).toBe(1);
      expect(findDataStreamDetailPanelTitle()).toBe('dataStream1');
    });

    test(`doesn't show data stream link if the index doesn't have a data stream`, () => {
      const {
        actions: { dataStreamLinkExistsAt },
      } = testBed;

      expect(dataStreamLinkExistsAt(1)).toBeFalsy();
    });
  });

  describe('index detail panel with % character in index name', () => {
    const indexName = 'test%';

    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([createNonDataStreamIndex(indexName)]);

      testBed = await setup(httpSetup);
      const { component, find } = testBed;

      component.update();

      find('indexTableIndexNameLink').at(0).simulate('click');
    });

    test('should encode indexName when loading settings in detail panel', async () => {
      const { actions } = testBed;
      await actions.selectIndexDetailsTab('settings');

      expect(httpSetup.get).toHaveBeenLastCalledWith(
        `${API_BASE_PATH}/settings/${encodeURIComponent(indexName)}`
      );
    });

    test('should encode indexName when loading mappings in detail panel', async () => {
      const { actions } = testBed;
      await actions.selectIndexDetailsTab('mappings');

      expect(httpSetup.get).toHaveBeenLastCalledWith(
        `${API_BASE_PATH}/mapping/${encodeURIComponent(indexName)}`
      );
    });

    test('should encode indexName when loading stats in detail panel', async () => {
      const { actions } = testBed;
      await actions.selectIndexDetailsTab('stats');

      expect(httpSetup.get).toHaveBeenLastCalledWith(
        `${API_BASE_PATH}/stats/${encodeURIComponent(indexName)}`
      );
    });

    test('should encode indexName when editing settings in detail panel', async () => {
      const { actions } = testBed;
      await actions.selectIndexDetailsTab('edit_settings');

      expect(httpSetup.get).toHaveBeenLastCalledWith(
        `${API_BASE_PATH}/settings/${encodeURIComponent(indexName)}`
      );
    });
  });

  describe('index actions', () => {
    const indexNameA = 'testIndexA';
    const indexNameB = 'testIndexB';
    const indexMockA = createNonDataStreamIndex(indexNameA);
    const indexMockB = createNonDataStreamIndex(indexNameB);

    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([
        {
          ...indexMockA,
          isFrozen: true,
        },
        {
          ...indexMockB,
          status: 'closed',
        },
      ]);
      httpRequestsMockHelpers.setReloadIndicesResponse({ indexNames: [indexNameA, indexNameB] });

      await act(async () => {
        testBed = await setup(httpSetup);
      });

      const { component, find } = testBed;
      component.update();

      find('indexTableIndexNameLink').at(0).simulate('click');
    });

    test('should be able to refresh index', async () => {
      const { actions } = testBed;

      await actions.clickManageContextMenuButton();
      await actions.clickContextMenuOption('refreshIndexMenuButton');

      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/refresh`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });

    test('should be able to close an open index', async () => {
      const { actions } = testBed;

      await actions.clickManageContextMenuButton();
      await actions.clickContextMenuOption('closeIndexMenuButton');

      // After the index is closed, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/close`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });

    test('should be able to open a closed index', async () => {
      await act(async () => {
        testBed = await setup(httpSetup);
      });
      const { component, find, actions } = testBed;

      component.update();

      find('indexTableIndexNameLink').at(1).simulate('click');

      await actions.clickManageContextMenuButton();
      await actions.clickContextMenuOption('openIndexMenuButton');

      // After the index is opened, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/open`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });

    test('should be able to flush index', async () => {
      const { actions } = testBed;

      await actions.clickManageContextMenuButton();
      await actions.clickContextMenuOption('flushIndexMenuButton');

      // After the index is flushed, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/flush`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });

    test("should be able to clear an index's cache", async () => {
      const { actions } = testBed;

      await actions.clickManageContextMenuButton();
      await actions.clickContextMenuOption('clearCacheIndexMenuButton');

      // After the index cache is cleared, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/clear_cache`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });

    test('should be able to unfreeze a frozen index', async () => {
      const { actions, exists } = testBed;

      httpRequestsMockHelpers.setReloadIndicesResponse([{ ...indexMockA, isFrozen: false }]);

      // Open context menu
      await actions.clickManageContextMenuButton();
      // Check that the unfreeze action exists for the current index and unfreeze it
      expect(exists('unfreezeIndexMenuButton')).toBe(true);
      await actions.clickContextMenuOption('unfreezeIndexMenuButton');

      // After the index is unfrozen, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/unfreeze`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );

      // Open context menu once again, since clicking an action will close it.
      await actions.clickManageContextMenuButton();
      // The unfreeze action should not be present anymore
      expect(exists('unfreezeIndexMenuButton')).toBe(false);
    });

    test('should be able to force merge an index', async () => {
      const { actions, exists } = testBed;

      httpRequestsMockHelpers.setReloadIndicesResponse([{ ...indexMockA, isFrozen: false }]);

      // Open context menu
      await actions.clickManageContextMenuButton();
      // Check that the force merge action exists for the current index and merge it
      expect(exists('forcemergeIndexMenuButton')).toBe(true);
      await actions.clickContextMenuOption('forcemergeIndexMenuButton');

      await actions.clickModalConfirm();

      // After the index force merged, we imediately do a reload. So we need to expect to see
      // a reload server call also.
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/forcemerge`,
        expect.anything()
      );
      expect(httpSetup.post).toHaveBeenCalledWith(
        `${API_BASE_PATH}/indices/reload`,
        expect.anything()
      );
    });
  });

  describe('Edit index settings', () => {
    const indexName = 'test';

    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([createNonDataStreamIndex(indexName)]);

      testBed = await setup(httpSetup);
      const { component, find } = testBed;

      component.update();

      find('indexTableIndexNameLink').at(0).simulate('click');
    });

    test('shows error callout when request fails', async () => {
      const { actions, find, component, exists } = testBed;

      mockGetAceEditorValue.mockReturnValue(`{
        "index.routing.allocation.include._tier_preference": "non_existent_tier"
      }`);

      const error = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'invalid tier names found in ...',
      };
      httpRequestsMockHelpers.setUpdateIndexSettingsResponse(indexName, undefined, error);

      await actions.selectIndexDetailsTab('edit_settings');

      await act(async () => {
        find('updateEditIndexSettingsButton').simulate('click');
      });

      component.update();

      expect(exists('updateIndexSettingsErrorCallout')).toBe(true);
    });
  });

  describe('Index stats', () => {
    const indexName = 'test';

    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([createNonDataStreamIndex(indexName)]);

      await act(async () => {
        testBed = await setup(httpSetup);
      });

      const { component } = testBed;

      component.update();
    });

    test('renders the table column with index stats by default', () => {
      const { table } = testBed;
      const { tableCellsValues } = table.getMetaData('indexTable');

      expect(tableCellsValues).toEqual([
        ['', 'test', 'green', 'open', '1', '1', '10000', '156kb', ''],
      ]);
    });

    test('renders index stats in details flyout by default', async () => {
      const { component, find } = testBed;

      await act(async () => {
        find('indexTableIndexNameLink').at(0).simulate('click');
      });

      component.update();

      const descriptions = find('descriptionTitle');

      const descriptionText = descriptions
        .map((description) => {
          return description.text();
        })
        .sort();

      expect(descriptionText).toEqual([
        'Aliases',
        'Docs count',
        'Docs deleted',
        'Health',
        'Primaries',
        'Primary storage size',
        'Replicas',
        'Status',
        'Storage size',
      ]);
    });

    describe('Disabled', () => {
      beforeEach(async () => {
        await act(async () => {
          testBed = await setup(httpSetup, {
            config: {
              enableLegacyTemplates: true,
              enableIndexActions: true,
              enableIndexStats: false,
            },
          });
        });

        const { component } = testBed;

        component.update();
      });

      test('hides index stats information from table', async () => {
        const { table } = testBed;
        const { tableCellsValues } = table.getMetaData('indexTable');

        expect(tableCellsValues).toEqual([['', 'test', '1', '1', '']]);
      });

      test('hides index stats information from details panel', async () => {
        const { component, find } = testBed;
        await act(async () => {
          find('indexTableIndexNameLink').at(0).simulate('click');
        });

        component.update();

        const descriptions = find('descriptionTitle');

        const descriptionText = descriptions
          .map((description) => {
            return description.text();
          })
          .sort();

        expect(descriptionText).toEqual(['Aliases', 'Primaries', 'Replicas']);
      });
    });
  });

  describe('Create Index', () => {
    const indexNameA = 'test-index-a';
    const indexNameB = 'test-index-b';
    const indexMockA = createNonDataStreamIndex(indexNameA);

    beforeEach(async () => {
      httpRequestsMockHelpers.setLoadIndicesResponse([
        {
          ...indexMockA,
        },
      ]);

      testBed = await setup(httpSetup, {
        history: createMemoryHistory(),
      });

      await act(async () => {
        const { component } = testBed;

        await nextTick();
        component.update();
      });
    });

    test('shows the create index button', async () => {
      const { exists } = testBed;

      expect(exists('createIndexButton')).toBe(true);
    });

    test('can open & close the create index modal', async () => {
      const { exists, actions } = testBed;

      await actions.clickCreateIndexButton();

      expect(exists('createIndexNameFieldText')).toBe(true);

      await await actions.clickCreateIndexCancelButton();

      expect(exists('createIndexNameFieldText')).toBe(false);
    });

    test('creating an index', async () => {
      const { component, exists, find, actions } = testBed;

      expect(httpSetup.get).toHaveBeenCalledTimes(1);
      expect(httpSetup.get).toHaveBeenNthCalledWith(1, '/api/index_management/indices');

      await actions.clickCreateIndexButton();

      expect(exists('createIndexNameFieldText')).toBe(true);
      await act(async () => {
        find('createIndexNameFieldText').simulate('change', { target: { value: indexNameB } });
      });
      component.update();

      await actions.clickCreateIndexSaveButton();

      // Saves the index with expected name
      expect(httpSetup.put).toHaveBeenCalledWith(`${INTERNAL_API_BASE_PATH}/indices/create`, {
        body: '{"indexName":"test-index-b"}',
      });
      // It refresh indices after saving
      expect(httpSetup.get).toHaveBeenCalledTimes(2);
      expect(httpSetup.get).toHaveBeenNthCalledWith(2, '/api/index_management/indices');
    });
  });
});
