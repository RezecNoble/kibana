/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as yaml from 'js-yaml';
import type { UrlObject } from 'url';
import Url from 'url';

import type { ROLES } from '@kbn/security-solution-plugin/common/test';
import { LoginState } from '@kbn/security-plugin/common/login_state';
import { LOGOUT_URL } from '../urls/navigation';

/**
 * Credentials in the `kibana.dev.yml` config file will be used to authenticate
 * with Kibana when credentials are not provided via environment variables
 */
const KIBANA_DEV_YML_PATH = '../../../config/kibana.dev.yml';

/**
 * The configuration path in `kibana.dev.yml` to the username to be used when
 * authenticating with Kibana.
 */
const ELASTICSEARCH_USERNAME_CONFIG_PATH = 'config.elasticsearch.username';

/**
 * The configuration path in `kibana.dev.yml` to the password to be used when
 * authenticating with Kibana.
 */
const ELASTICSEARCH_PASSWORD_CONFIG_PATH = 'config.elasticsearch.password';

/**
 * The `CYPRESS_ELASTICSEARCH_USERNAME` environment variable specifies the
 * username to be used when authenticating with Kibana
 */
const ELASTICSEARCH_USERNAME = 'ELASTICSEARCH_USERNAME';

/**
 * The `CYPRESS_ELASTICSEARCH_PASSWORD` environment variable specifies the
 * username to be used when authenticating with Kibana
 */
const ELASTICSEARCH_PASSWORD = 'ELASTICSEARCH_PASSWORD';

/**
 * cy.visit will default to the baseUrl which uses the default kibana test user
 * This function will override that functionality in cy.visit by building the baseUrl
 * directly from the environment variables set up in x-pack/test/security_solution_cypress/runner.ts
 *
 * @param role string role/user to log in with
 * @param route string route to visit
 */
export const getUrlWithRoute = (role: ROLES, route: string) => {
  const url = Cypress.config().baseUrl;
  const kibana = new URL(String(url));
  const theUrl = `${Url.format({
    auth: `${role}:changeme`,
    username: role,
    password: 'changeme',
    protocol: kibana.protocol.replace(':', ''),
    hostname: kibana.hostname,
    port: kibana.port,
  } as UrlObject)}${route.startsWith('/') ? '' : '/'}${route}`;
  cy.log(`origin: ${theUrl}`);
  return theUrl;
};

export interface User {
  username: string;
  password: string;
}

/**
 * Builds a URL with basic auth using the passed in user.
 *
 * @param user the user information to build the basic auth with
 * @param route string route to visit
 */
export const constructUrlWithUser = (user: User, route: string) => {
  const url = Cypress.config().baseUrl;
  const kibana = new URL(String(url));
  const hostname = kibana.hostname;
  const username = user.username;
  const password = user.password;
  const protocol = kibana.protocol.replace(':', '');
  const port = kibana.port;

  const path = `${route.startsWith('/') ? '' : '/'}${route}`;
  const strUrl = `${protocol}://${username}:${password}@${hostname}:${port}${path}`;
  const builtUrl = new URL(strUrl);

  cy.log(`origin: ${builtUrl.href}`);
  return builtUrl.href;
};

const getCurlScriptEnvVars = () => ({
  ELASTICSEARCH_URL: Cypress.env('ELASTICSEARCH_URL'),
  ELASTICSEARCH_USERNAME: Cypress.env('ELASTICSEARCH_USERNAME'),
  ELASTICSEARCH_PASSWORD: Cypress.env('ELASTICSEARCH_PASSWORD'),
  KIBANA_URL: Cypress.config().baseUrl,
});

const postRoleAndUser = (role: ROLES) => {
  const env = getCurlScriptEnvVars();
  const detectionsRoleScriptPath = `../../plugins/security_solution/server/lib/detection_engine/scripts/roles_users/${role}/post_detections_role.sh`;
  const detectionsRoleJsonPath = `../../plugins/security_solution/server/lib/detection_engine/scripts/roles_users/${role}/detections_role.json`;
  const detectionsUserScriptPath = `../../plugins/security_solution/server/lib/detection_engine/scripts/roles_users/${role}/post_detections_user.sh`;
  const detectionsUserJsonPath = `../../plugins/security_solution/server/lib/detection_engine/scripts/roles_users/${role}/detections_user.json`;

  // post the role
  cy.exec(`bash ${detectionsRoleScriptPath} ${detectionsRoleJsonPath}`, {
    env,
  });

  // post the user associated with the role to elasticsearch
  cy.exec(`bash ${detectionsUserScriptPath} ${detectionsUserJsonPath}`, {
    env,
  });
};

export const deleteRoleAndUser = (role: ROLES) => {
  const env = getCurlScriptEnvVars();
  const detectionsUserDeleteScriptPath = `../../plugins/security_solution/server/lib/detection_engine/scripts/roles_users/${role}/delete_detections_user.sh`;

  // delete the role
  cy.exec(`bash ${detectionsUserDeleteScriptPath}`, {
    env,
  });
};

const loginWithUsernameAndPassword = (username: string, password: string) => {
  const baseUrl = Cypress.config().baseUrl;
  if (!baseUrl) {
    throw Error(`Cypress config baseUrl not set!`);
  }

  // Programmatically authenticate without interacting with the Kibana login page.
  const headers = { 'kbn-xsrf': 'cypress-creds', 'x-elastic-internal-origin': 'security-solution' };
  cy.request<LoginState>({ headers, url: `${baseUrl}/internal/security/login_state` }).then(
    (loginState) => {
      const basicProvider = loginState.body.selector.providers.find(
        (provider) => provider.type === 'basic'
      );
      return cy.request({
        url: `${baseUrl}/internal/security/login`,
        method: 'POST',
        headers,
        body: {
          providerType: basicProvider.type,
          providerName: basicProvider.name,
          currentURL: '/',
          params: { username, password },
        },
      });
    }
  );
};

export const loginWithUser = (user: User) => {
  cy.session(user, () => {
    loginWithUsernameAndPassword(user.username, user.password);
  });
};

const loginWithRole = (role: ROLES) => {
  postRoleAndUser(role);

  cy.log(`origin: ${Cypress.config().baseUrl}`);
  cy.session(role, () => {
    loginWithUsernameAndPassword(role, 'changeme');
  });
};

/**
 * Authenticates with Kibana using, if specified, credentials specified by
 * environment variables. The credentials in `kibana.dev.yml` will be used
 * for authentication when the environment variables are unset.
 *
 * To speed the execution of tests, prefer this non-interactive authentication,
 * which is faster than authentication via Kibana's interactive login page.
 */
export const login = (role?: ROLES) => {
  if (role != null) {
    loginWithRole(role);
  } else if (credentialsProvidedByEnvironment()) {
    loginViaEnvironmentCredentials();
  } else {
    loginViaConfig();
  }
};

/**
 * Returns `true` if the credentials used to login to Kibana are provided
 * via environment variables
 */
const credentialsProvidedByEnvironment = (): boolean =>
  Cypress.env(ELASTICSEARCH_USERNAME) != null && Cypress.env(ELASTICSEARCH_PASSWORD) != null;

/**
 * Authenticates with Kibana by reading credentials from the
 * `CYPRESS_ELASTICSEARCH_USERNAME` and `CYPRESS_ELASTICSEARCH_PASSWORD`
 * environment variables, and POSTing the username and password directly to
 * Kibana's `/internal/security/login` endpoint, bypassing the login page (for speed).
 */
const loginViaEnvironmentCredentials = () => {
  cy.log(
    `Authenticating via environment credentials from the \`CYPRESS_${ELASTICSEARCH_USERNAME}\` and \`CYPRESS_${ELASTICSEARCH_PASSWORD}\` environment variables`
  );

  const username = Cypress.env(ELASTICSEARCH_USERNAME);
  const password = Cypress.env(ELASTICSEARCH_PASSWORD);

  cy.session([username, password], () => {
    loginWithUsernameAndPassword(username, password);
  });
};

/**
 * Authenticates with Kibana by reading credentials from the
 * `kibana.dev.yml` file and POSTing the username and password directly to
 * Kibana's `/internal/security/login` endpoint, bypassing the login page (for speed).
 */
const loginViaConfig = () => {
  cy.log(
    `Authenticating via config credentials \`${ELASTICSEARCH_USERNAME_CONFIG_PATH}\` and \`${ELASTICSEARCH_PASSWORD_CONFIG_PATH}\` from \`${KIBANA_DEV_YML_PATH}\``
  );

  // read the login details from `kibana.dev.yaml`
  cy.readFile(KIBANA_DEV_YML_PATH).then((kibanaDevYml) => {
    const { username, password } = yaml.safeLoad(kibanaDevYml);
    loginWithUsernameAndPassword(username, password);
  });
};

/**
 * Get the configured auth details that were used to spawn cypress
 *
 * @returns the default Elasticsearch username and password for this environment
 */
export const getEnvAuth = (): User => {
  if (credentialsProvidedByEnvironment()) {
    return {
      username: Cypress.env(ELASTICSEARCH_USERNAME),
      password: Cypress.env(ELASTICSEARCH_PASSWORD),
    };
  } else {
    let user: User = { username: '', password: '' };
    cy.readFile(KIBANA_DEV_YML_PATH).then((devYml) => {
      const config = yaml.safeLoad(devYml);
      user = { username: config.elasticsearch.username, password: config.elasticsearch.password };
    });

    return user;
  }
};

export const logout = () => {
  cy.visit(LOGOUT_URL);
};
