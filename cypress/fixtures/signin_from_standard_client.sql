INSERT INTO users
  (id, email, email_verified, email_verified_at, encrypted_password, created_at, updated_at, given_name, family_name,
   phone_number, job)
VALUES
  (1, 'unused1@yopmail.com', true, CURRENT_TIMESTAMP, '$2a$10$kzY3LINL6..50Fy9shWCcuNlRfYq0ft5lS.KCcJ5PzrhlWfKK4NIO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Jean', 'Jean1', '0123456789', 'Sbire'),
  (2, 'unused2@yopmail.com', true, CURRENT_TIMESTAMP, '$2a$10$kzY3LINL6..50Fy9shWCcuNlRfYq0ft5lS.KCcJ5PzrhlWfKK4NIO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Jean', 'Jean2', '0123456789', 'Sbire');


INSERT INTO organizations
  (id, siret, verified_email_domains, authorized_email_domains, created_at, updated_at)
VALUES
  (1, '21340126800130', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, '21920023500014', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO users_organizations
  (user_id, organization_id, is_external, verification_type, authentication_by_peers_type, has_been_greeted)
VALUES
  (1, 1, false, 'verified_email_domain', 'all_members_notified', true),
  (2, 1, false, 'verified_email_domain', 'all_members_notified', true),
  (2, 2, false, 'verified_email_domain', 'all_members_notified', true);

INSERT INTO oidc_clients
  (client_name, client_id, client_secret, redirect_uris,
   post_logout_redirect_uris, scope, client_uri, client_description,
   userinfo_signed_response_alg, id_token_signed_response_alg,
   authorization_signed_response_alg, introspection_signed_response_alg)
VALUES
  ('Oidc Test Client',
   'standard_client_id',
   'standard_client_secret',
   ARRAY [
     'http://localhost:4000/login-callback'
     ],
   ARRAY []::varchar[],
   'openid email profile organization',
   'http://localhost:4000/',
   'This is a small, golang-based OIDC Client, to be used in End-to-end or other testing. More info: https://hub.docker.com/r/beryju/oidc-test-client.',
   null, null, null, null);
