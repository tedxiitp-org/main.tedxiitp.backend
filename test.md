# TEDx Wall of Memory - Postman Testing Guide

This guide provides the raw JSON payloads and endpoint details so you can easily copy and paste them into **Postman** to test your backend API.

## Base URL
`http://localhost:3000`

---

## 1. Get All Memories
Retrieves all memories sorted by newest first.

*   **Method**: `GET`
*   **URL**: `/api/memories`
*   **Headers**: None required
*   **Body**: None

---

## 2. Pin a New Memory (Success)
Creates a new memory with valid data.

*   **Method**: `POST`
*   **URL**: `/api/memories`
*   **Headers**: 
    *   `Content-Type: application/json`
*   **Body (raw JSON)**:
    ```json
    {
        "name": "Ananya Sharma",
        "roleCategory": "Organizer",
        "customRoleTitle": "Lead Organizer",
        "memoryText": "Seeing the audience react to the final talk was an unforgettable experience. All the hard work paid off!"
    }
    ```

---

## 3. Pin a New Memory (Validation Error - Missing Field)
Tests the validation for missing required fields (e.g., missing `memoryText`).

*   **Method**: `POST`
*   **URL**: `/api/memories`
*   **Headers**: 
    *   `Content-Type: application/json`
*   **Body (raw JSON)**:
    ```json
    {
        "name": "Rahul Kumar",
        "roleCategory": "Coordinator"
    }
    ```
*   **Expected Response (400 Bad Request)**: 
    `{ "error": "Name, Role Category, and Memory Text are required fields." }`

---

## 4. Pin a New Memory (Validation Error - Invalid Role Category)
Tests the strict enum dropdown validation for the `roleCategory` field.

*   **Method**: `POST`
*   **URL**: `/api/memories`
*   **Headers**: 
    *   `Content-Type: application/json`
*   **Body (raw JSON)**:
    ```json
    {
        "name": "Priya Singh",
        "roleCategory": "Speaker",
        "memoryText": "I loved giving a talk!"
    }
    ```
*   **Expected Response (400 Bad Request)**:
    `{ "error": "Invalid Role Category. Must be Organizer, Coordinator, or Subcoordinator." }`

---

## 5. Like a Memory
Increments the like counter on an existing memory. You need to replace `<memory_id>` in the URL with a real ID from the "Get All Memories" response.

*   **Method**: `PATCH`
*   **URL**: `/api/memories/<memory_id>/like`
*   **Headers**: None required
*   **Body**: None
*   **Expected Response (200 OK)**:
    `{ "message": "Memory liked successfully", "data": { ... } }`

---

## 6. Unlike a Memory
Decrements the like counter on an existing memory (cannot drop below 0). You need to replace `<memory_id>` in the URL with a real ID from the "Get All Memories" response.

*   **Method**: `PATCH`
*   **URL**: `/api/memories/<memory_id>/unlike`
*   **Headers**: None required
*   **Body**: None
*   **Expected Response (200 OK)**:
    `{ "message": "Memory unliked successfully", "data": { ... } }`

---

## 7. Delete a Memory
Deletes an existing memory. You need to replace `<memory_id>` in the URL with a real ID from the "Get All Memories" response.

*   **Method**: `DELETE`
*   **URL**: `/api/memories/<memory_id>`
*   **Headers**: None required
*   **Body**: None
*   **Expected Response (200 OK)**:
    `{ "message": "Memory deleted successfully", "data": { ... } }`
