
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

---

## 🛍️ Products API

### Get All Products
Retrieves a list of all products in the database.
- **URL**: `/products`
- **Method**: `GET`
- **Response**: Array of product objects.

### Get Product by Slug/ID
Retrieves a single product using its slug.
- **URL**: `/products/:id`
- **Method**: `GET`
- **Response**: Single product object.

### Create Product (Admin)
Creates a new product (Merchandise or Ticket).
- **URL**: `/admin/products`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "TedX Official Mug",
    "slug": "tedx-official-mug",
    "description": "Elegant ceramic mug.",
    "type": "MERCH",
    "price": 350,
    "currency": "INR",
    "stock": 50,
    "isUnlimitedStock": false,
    "images": ["https://example.com/mug.png"],
    "sizes": ["Regular"]
  }
  ```

### Update Product (Admin)
Updates product details by slug.
- **URL**: `/admin/products/:id`
- **Method**: `PATCH`
- **Body**: JSON patch payload containing fields to update.

### Delete Product (Admin)
Deletes a product by slug.
- **URL**: `/admin/products/:id`
- **Method**: `DELETE`

---

## 🛒 Cart API

### Get Cart
Retrieves the user's active shopping cart, auto-calculating subtotals and totals based on current product prices.
- **URL**: `/cart/:userId` (or via query/body `userId`)
- **Method**: `GET`
- **Response**: The cart object showing items, quantities, and totals.

### Add Item to Cart
Adds a product to the user's shopping cart. Checks stock availability before adding.
- **URL**: `/cart/add`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "userId": "user_id_string",
    "productId": "product_slug_string",
    "quantity": 1,
    "productType": "MERCH",
    "selectedSize": "M"
  }
  ```

### Update Item Quantity
Updates the quantity of a specific product already in the cart.
- **URL**: `/cart/update`
- **Method**: `PATCH`
- **Body**:
  ```json
  {
    "userId": "user_id_string",
    "productId": "product_slug_string",
    "quantity": 3
  }
  ```

### Remove Item from Cart
Removes a specific product from the cart.
- **URL**: `/cart/remove/:productId`
- **Method**: `DELETE`
- **Body**:
  ```json
  {
    "userId": "user_id_string"
  }
  ```

### Clear Cart
Completely empties and deletes the user's cart.
- **URL**: `/cart/clear`
- **Method**: `DELETE`
- **Body**:
  ```json
  {
    "userId": "user_id_string"
  }
  ```

---

## 📧 Mail & Queue API

The mailing system uses **BullMQ** + **Redis** to queue and process email sending asynchronously. It logs queue statuses in MongoDB and supports dynamic templates with custom HTML placeholders like `{{name}}`.

### Send Email (Enqueue Job)
Queues a new email job.
- **URL**: `/email`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "recipientEmail": "recipient@example.com",
    "recipientName": "Jane Doe",
    "templateName": "welcome_template",
    "subject": "Welcome to TEDxIITPatna!",
    "variables": {
      "name": "Jane"
    },
    "attachments": [
      {
        "filename": "ticket.pdf",
        "url": "https://example.com/ticket.pdf",
        "mimeType": "application/pdf"
      }
    ],
    "metadata": {
      "userId": "12345"
    }
  }
  ```

### Upload Email Template
Registers a new reusable HTML email template.
- **URL**: `/email/template`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "welcome_template",
    "subject": "Welcome to the Event!",
    "htmlBody": "<h1>Hello {{name}},</h1><p>Thanks for registering!</p>",
    "isActive": true
  }
  ```

### Update Email Template
Updates an existing template by its name.
- **URL**: `/email/template/:id` (where `:id` is template name)
- **Method**: `POST`
- **Body**: JSON template updates.

### Delete Email Template
Deletes a template by name.
- **URL**: `/email/template`
- **Method**: `DELETE`
- **Body**:
  ```json
  {
    "name": "welcome_template"
  }
  ```

### BullMQ Dashboard (Bull Board)
Provides an interactive web dashboard for monitoring enqueued, processing, completed, and failed email jobs.
- **URL**: `/admin/queues`
- **Method**: `GET`
- **Response**: Interactive UI dashboard.

---

## 🏃 Running the Mail Queue Worker

To process the enqueued emails in the background (make sure Redis is running and SMTP credentials are set in your `.env`):
```bash
npm run worker
```

