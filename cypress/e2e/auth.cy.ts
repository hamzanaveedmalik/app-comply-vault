describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should redirect unauthenticated users to sign in page', () => {
    cy.url().should('include', '/auth/signin');
    cy.get('h1').contains('Sign In', { matchCase: false });
  });

  it('should display Discord OAuth button', () => {
    cy.visit('/auth/signin');
    cy.get('button').contains('Continue with Discord', { matchCase: false });
  });

  // This test requires mocking Discord OAuth, which would be configured separately
  it.skip('should allow signing in with Discord', () => {
    // Mock would be implemented here
  });
});