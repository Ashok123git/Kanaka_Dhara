describe('File upload', () => {
  const uploadUrl = '/api/v1/uploads'

  beforeEach(() => {
    cy.visit('/upload')
  })

  it('uploads a valid file and shows success message', () => {
    cy.intercept('POST', uploadUrl, {
      statusCode: 200,
      body: {
        fileName: 'valid-file.pdf',
        message: 'Upload successful',
      },
    }).as('uploadFile')

    cy.get('[data-testid="file-input"]').selectFile(
      'cypress/fixtures/valid-file.pdf',
    )
    cy.get('[data-testid="upload-button"]').click()

    cy.wait('@uploadFile')

    cy.get('[data-testid="upload-success"]').should(
      'contain.text',
      'Upload successful',
    )
    cy.get('[data-testid="upload-error"]').should('not.exist')
  })

  it('displays uploaded file name in the UI', () => {
    cy.intercept('POST', uploadUrl, {
      statusCode: 200,
      body: {
        fileName: 'valid-file.pdf',
        message: 'Upload successful',
      },
    }).as('uploadFile')

    cy.get('[data-testid="file-input"]').selectFile(
      'cypress/fixtures/valid-file.pdf',
    )
    cy.get('[data-testid="upload-button"]').click()

    cy.wait('@uploadFile')

    cy.get('[data-testid="uploaded-file-name"]').should(
      'contain.text',
      'valid-file.pdf',
    )
  })

  it('shows error for invalid file format from backend', () => {
    cy.intercept('POST', uploadUrl, {
      statusCode: 400,
      body: {
        detail: 'Invalid file format',
      },
    }).as('uploadFileInvalid')

    cy.get('[data-testid="file-input"]').selectFile(
      'cypress/fixtures/invalid-file.exe',
    )
    cy.get('[data-testid="upload-button"]').click()

    cy.wait('@uploadFileInvalid')

    cy.get('[data-testid="upload-error"]').should(
      'contain.text',
      'Invalid file format',
    )
    cy.get('[data-testid="upload-success"]').should('not.exist')
  })

  it('prevents submit when no file is selected', () => {
    cy.intercept('POST', uploadUrl).as('uploadFile')

    cy.get('[data-testid="upload-button"]').click()

    cy.get('[data-testid="upload-error"]').should(
      'contain.text',
      'Please select a file',
    )

    cy.get('@uploadFile.all').should('have.length', 0)
  })
})

