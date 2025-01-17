const MONCOMPTEPRO_HOST =
  Cypress.env('MONCOMPTEPRO_HOST') || 'http://localhost:3000';

describe('sign-in from legacy client', () => {
  it('should sign-in', function () {
    cy.visit(`http://localhost:4002`);
    cy.get('button.moncomptepro-button').click();

    cy.get('[name="login"]').type('unused1@yopmail.com');
    cy.get('[type="submit"]').click();

    cy.get('[name="password"]').type('password123');
    cy.get('[action="/users/sign-in"]  [type="submit"]')
      .contains('Se connecter')
      .click();

    cy.contains('unused1@yopmail.com');
    cy.contains('Commune de lamalou-les-bains');
  });
});
