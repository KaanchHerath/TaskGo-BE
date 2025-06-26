# TaskGo-BE

## API Endpoints

### POST /api/auth/register-tasker
Registers a new tasker user with file uploads.

**Content-Type:** multipart/form-data

**Fields:**
- `email` (string, required, unique)
- `password` (string, required)
- `fullName` (string, required)
- `skills` (string or array, required)
- `country` (string, required)
- `area` (string, required)
- `idDocument` (file, required)
- `qualificationDocuments` (file(s), optional, can be multiple)

**Note:** Password confirmation (`confirmPassword`) is handled on the frontend only and should not be sent to the backend.

**Returns:**
- `201 Created` with `{ token, user: { id, email, role } }` on success
- `400 Bad Request` with error message on validation failure

**File Storage:**
- Uploaded files are stored in `/uploads/tasker-docs/`

**Example cURL:**
```sh
curl -X POST http://localhost:5000/api/auth/register-tasker \
  -F "email=tasker@example.com" \
  -F "password=TestPass123!" \
  -F "fullName=Test Tasker" \
  -F "skills=plumbing" \
  -F "country=TestCountry" \
  -F "area=TestArea" \
  -F "idDocument=@/path/to/id.pdf" \
  -F "qualificationDocuments=@/path/to/qual.pdf"
```

---

## Automated Tests

Tests are written with [Vitest](https://vitest.dev/) and [supertest](https://github.com/ladjs/supertest).

- Test file: `src/__tests__/auth.test.mjs`
- Run tests: `npm run test:vitest --prefix TaskGo-BE`

### Test Coverage for /auth/register-tasker
- Registers a tasker with file upload and returns JWT with role
- Fails if required fields are missing
- Fails if idDocument is missing

---

**Update this documentation whenever endpoints or tests change.**