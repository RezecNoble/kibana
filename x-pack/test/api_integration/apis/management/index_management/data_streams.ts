/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';

import { DataStream } from '@kbn/index-management-plugin/common';
import { FtrProviderContext } from '../../../ftr_provider_context';
// @ts-ignore
import { API_BASE_PATH } from './constants';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const es = getService('es');

  const createDataStream = async (name: string) => {
    // A data stream requires an index template before it can be created.
    await es.indices.putIndexTemplate({
      name,
      body: {
        // We need to match the names of backing indices with this template.
        index_patterns: [name + '*'],
        template: {
          mappings: {
            properties: {
              '@timestamp': {
                type: 'date',
              },
            },
          },
        },
        data_stream: {},
      },
    });

    await es.indices.createDataStream({ name });
  };

  const updateIndexTemplateMappings = async (name: string, mappings: any) => {
    await es.indices.putIndexTemplate({
      name,
      body: {
        // We need to match the names of backing indices with this template.
        index_patterns: [name + '*'],
        template: {
          mappings,
        },
        data_stream: {},
      },
    });
  };

  const getDatastream = async (name: string) => {
    const {
      data_streams: [datastream],
    } = await es.indices.getDataStream({ name });
    return datastream;
  };

  const getMapping = async (name: string) => {
    const res = await es.indices.getMapping({ index: name });

    return Object.values(res)[0]!.mappings;
  };

  const deleteComposableIndexTemplate = async (name: string) => {
    await es.indices.deleteIndexTemplate({ name });
  };

  const deleteDataStream = async (name: string) => {
    await es.indices.deleteDataStream({ name });
    await deleteComposableIndexTemplate(name);
  };

  const assertDataStreamStorageSizeExists = (storageSize: string, storageSizeBytes: number) => {
    // Storage size of a document doesn't look like it would be deterministic (could vary depending
    // on how ES, Lucene, and the file system interact), so we'll just assert its presence and
    // type.
    expect(storageSize).to.be.ok();
    expect(typeof storageSize).to.be('string');
    expect(storageSizeBytes).to.be.ok();
    expect(typeof storageSizeBytes).to.be('number');
  };

  describe('Data streams', function () {
    describe('Get', () => {
      const testDataStreamName = 'test-data-stream';

      before(async () => await createDataStream(testDataStreamName));
      after(async () => await deleteDataStream(testDataStreamName));

      it('returns an array of data streams', async () => {
        const { body: dataStreams } = await supertest
          .get(`${API_BASE_PATH}/data_streams`)
          .set('kbn-xsrf', 'xxx')
          .expect(200);

        expect(dataStreams).to.be.an('array');

        // returned array can contain automatically created data streams
        const testDataStream = dataStreams.find(
          (dataStream: DataStream) => dataStream.name === testDataStreamName
        );

        expect(testDataStream).to.be.ok();

        // ES determines these values so we'll just echo them back.
        const { name: indexName, uuid } = testDataStream!.indices[0];

        expect(testDataStream).to.eql({
          name: testDataStreamName,
          lifecycle: {
            enabled: true,
          },
          privileges: {
            delete_index: true,
          },
          timeStampField: { name: '@timestamp' },
          indices: [
            {
              name: indexName,
              uuid,
            },
          ],
          generation: 1,
          health: 'yellow',
          indexTemplateName: testDataStreamName,
          hidden: false,
        });
      });

      it('includes stats when provided the includeStats query parameter', async () => {
        const { body: dataStreams } = await supertest
          .get(`${API_BASE_PATH}/data_streams?includeStats=true`)
          .set('kbn-xsrf', 'xxx')
          .expect(200);

        expect(dataStreams).to.be.an('array');

        // returned array can contain automatically created data streams
        const testDataStream = dataStreams.find(
          (dataStream: DataStream) => dataStream.name === testDataStreamName
        );

        expect(testDataStream).to.be.ok();

        // ES determines these values so we'll just echo them back.
        const { name: indexName, uuid } = testDataStream!.indices[0];
        const { storageSize, storageSizeBytes, ...dataStreamWithoutStorageSize } = testDataStream!;
        assertDataStreamStorageSizeExists(storageSize, storageSizeBytes);

        expect(dataStreamWithoutStorageSize).to.eql({
          name: testDataStreamName,
          privileges: {
            delete_index: true,
          },
          timeStampField: { name: '@timestamp' },
          indices: [
            {
              name: indexName,
              uuid,
            },
          ],
          generation: 1,
          health: 'yellow',
          indexTemplateName: testDataStreamName,
          maxTimeStamp: 0,
          hidden: false,
          lifecycle: {
            enabled: true,
          },
        });
      });

      it('returns a single data stream by ID', async () => {
        const { body: dataStream } = await supertest
          .get(`${API_BASE_PATH}/data_streams/${testDataStreamName}`)
          .set('kbn-xsrf', 'xxx')
          .expect(200);

        // ES determines these values so we'll just echo them back.
        const { name: indexName, uuid } = dataStream.indices[0];
        const { storageSize, storageSizeBytes, ...dataStreamWithoutStorageSize } = dataStream;
        assertDataStreamStorageSizeExists(storageSize, storageSizeBytes);

        expect(dataStreamWithoutStorageSize).to.eql({
          name: testDataStreamName,
          privileges: {
            delete_index: true,
          },
          timeStampField: { name: '@timestamp' },
          indices: [
            {
              name: indexName,
              uuid,
            },
          ],
          generation: 1,
          health: 'yellow',
          indexTemplateName: testDataStreamName,
          maxTimeStamp: 0,
          hidden: false,
          lifecycle: {
            enabled: true,
          },
        });
      });
    });

    describe('Delete', () => {
      const testDataStreamName1 = 'test-data-stream1';
      const testDataStreamName2 = 'test-data-stream2';

      before(async () => {
        await Promise.all([
          createDataStream(testDataStreamName1),
          createDataStream(testDataStreamName2),
        ]);
      });

      after(async () => {
        // The Delete API only deletes the data streams, so we still need to manually delete their
        // related index patterns to clean up.
        await Promise.all([
          deleteComposableIndexTemplate(testDataStreamName1),
          deleteComposableIndexTemplate(testDataStreamName2),
        ]);
      });

      it('deletes multiple data streams', async () => {
        await supertest
          .post(`${API_BASE_PATH}/delete_data_streams`)
          .set('kbn-xsrf', 'xxx')
          .send({
            dataStreams: [testDataStreamName1, testDataStreamName2],
          })
          .expect(200);

        await supertest
          .get(`${API_BASE_PATH}/data_streams/${testDataStreamName1}`)
          .set('kbn-xsrf', 'xxx')
          .expect(404);

        await supertest
          .get(`${API_BASE_PATH}/data_streams/${testDataStreamName2}`)
          .set('kbn-xsrf', 'xxx')
          .expect(404);
      });
    });

    describe('Mappings from template', () => {
      const testDataStreamName1 = 'test-data-stream-mappings-1';

      before(async () => {
        await createDataStream(testDataStreamName1);
      });

      after(async () => {
        await deleteDataStream(testDataStreamName1);
      });

      it('Apply mapping from index template', async () => {
        const beforeMapping = await getMapping(testDataStreamName1);
        expect(beforeMapping.properties).eql({
          '@timestamp': { type: 'date' },
        });
        await updateIndexTemplateMappings(testDataStreamName1, {
          properties: {
            test: { type: 'integer' },
          },
        });
        await supertest
          .post(`${API_BASE_PATH}/data_streams/${testDataStreamName1}/mappings_from_template`)
          .set('kbn-xsrf', 'xxx')
          .expect(200);

        const afterMapping = await getMapping(testDataStreamName1);
        expect(afterMapping.properties).eql({
          '@timestamp': { type: 'date' },
          test: { type: 'integer' },
        });
      });
    });

    describe('Rollover', () => {
      const testDataStreamName1 = 'test-data-stream-rollover-1';

      before(async () => {
        await createDataStream(testDataStreamName1);
      });

      after(async () => {
        await deleteDataStream(testDataStreamName1);
      });

      it('Rollover datastreams', async () => {
        await supertest
          .post(`${API_BASE_PATH}/data_streams/${testDataStreamName1}/rollover`)
          .set('kbn-xsrf', 'xxx')
          .expect(200);

        const datastream = await getDatastream(testDataStreamName1);

        expect(datastream.generation).equal(2);
      });
    });
  });
}
