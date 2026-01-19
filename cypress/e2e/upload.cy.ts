describe('File Upload', () => {
  beforeEach(() => {
    // Mock authentication
    cy.intercept('/api/auth/session', { fixture: 'auth-session.json' });
    cy.visit('/upload');
  });

  it('should display the upload interface', () => {
    cy.get('h1').contains('Upload', { matchCase: false });
  });

  it('should allow file selection', () => {
    cy.get('input[type=file]').should('exist');
  });

  // This test would require fixtures and mocking API responses
  it.skip('should allow uploading audio files', () => {
    cy.fixture('test-audio.mp3', 'binary')
      .then(Cypress.Blob.binaryStringToBlob)
      .then((fileContent) => {
        cy.get('input[type=file]').attachFile({
          fileContent,
          fileName: 'test-audio.mp3',
          mimeType: 'audio/mp3',
        });
      });
    
    // Mock the upload response
    cy.intercept('POST', '/api/upload', {
      statusCode: 200,
      body: {
        success: true,
        fileId: '123',
      },
    });
    
    cy.get('button[type=submit]').click();
    cy.contains('Upload successful').should('be.visible');
  });
});