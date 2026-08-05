
###  Clone the Repository
```bash
git clone https://github.com/iamkartik0704/memory.git
cd memory
```

###  Install Dependencies
```bash
npm install
```

###  Environment Variables
Create a `.env` file in the root directory and add your MongoDB connection string and required auth secrets:
```env
PORT=3000
MONGO_URI=
JWT_SECRET=your_super_secret_jwt_string_min_16_chars
SESSION_SECRET=your_super_secret_session_string_min_16_chars
SUPERADMIN_EMAIL=admin@tedx.com
SUPERADMIN_PASSWORD=your_secure_password
```

###  Admin Account Setup
Before managing memories, you must seed the database to create the default SuperAdmin account (using the credentials set in your `.env`):
```bash
npx tsx src/scripts/seed.ts
```

###  Run the Application
To start the development server (auto-reloads on changes):
```bash
npm run dev
```
To build and run for production:
```bash
npm run build
npm start
```

Your server should now be running at `http://localhost:3000` 

---

##  API Endpoints

### 1. Get All Memories
Retrieves all memories, sorted by the newest first.
- **URL**: `/api/memories`
- **Method**: `GET`
- **Response**: Array of memory objects.

###  Pin a New Memory
Creates and pins a new memory to the wall.
- **URL**: `/api/memories`
- **Method**: `POST`
- **Body**:
  ```json
  {
      "name": "Your Name",
      "roleCategory": "Organizer",
      "customRoleTitle": "Lead Organizer",
      "memoryText": "lorem34"
  }
  ```
- **Validation Rules**:
  - `name`, `roleCategory`, and `memoryText` are **required**.
  - `roleCategory` must exactly match one of the predefined roles.

### Like a Memory
Increments the like counter on a memory.
- **URL**: `/api/memories/:id/like`
- **Method**: `PATCH`
- **Response**: The updated memory object showing the new like count.

### Unlike a Memory
Decrements the like counter on a memory (won't drop below 0).
- **URL**: `/api/memories/:id/unlike`
- **Method**: `PATCH`
- **Response**: The updated memory object showing the new like count.

### Delete a Memory (Admin)
Deletes an existing memory from the wall. Requires an active admin session.
- **URL**: `/api/memories/:id`
- **Method**: `DELETE`
- **Headers**: Automatically authenticates via HTTP-only cookie.
- **Response**: Success message and the deleted memory data.

---

## Admin Auth Endpoints

### Login
Authenticates an admin and sets a secure session cookie.
- **URL**: `/api/admin/auth/login`
- **Method**: `POST`
- **Body**: 
  ```json
  {
    "email": "admin@tedx.com",
    "password": "your_secure_password"
  }
  ```

### Logout
Destroys the current admin session and clears the cookie.
- **URL**: `/api/admin/auth/logout`
- **Method**: `POST`

### Get Current Admin
Retrieves details of the currently logged-in admin.
- **URL**: `/api/admin/auth/me`
- **Method**: `GET`
