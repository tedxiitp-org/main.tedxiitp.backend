# Game Page Module - Testing Guide (Postman)

This guide provides step-by-step instructions for testing the Game Page module endpoints using Postman or cURL.

## Prerequisites
- Ensure your MongoDB instance is running locally (`mongodb://localhost:27017/tedx_game`).
- Ensure the server is running (`npm run dev` or `bun run dev`) on port `3000`.
- The Base URL for all endpoints is `http://localhost:3000/api/v1`

---

## 1. Identity & Users

We use a "No-Auth" system where a player provides a username and receives a unique `userId`.

### Request Identity
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/v1/users/identity`
* **Body (raw JSON):**
  ```json
  {
      "username": "tester123"
  }
  ```
* **Note:** Copy the `userId` from the response. You will need it for the following steps!

---

## 2. Games Management

For testing purposes, we added an endpoint to create games directly.

### Create Game Type A (Infinite Runner / Score Based)
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/v1/games`
* **Body (raw JSON):**
  ```json
  {
      "name": "Endless Runner",
      "type": "A",
      "description": "Get the highest score by surviving as long as possible."
  }
  ```
* **Note:** Copy the `_id` of the created game (let's call it `<GAME_A_ID>`).

### Create Game Type B (Time/Level Based)
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/v1/games`
* **Body (raw JSON):**
  ```json
  {
      "name": "Speedrun Puzzle",
      "type": "B",
      "description": "Complete the puzzle as fast as possible."
  }
  ```
* **Note:** Copy the `_id` of the created game (let's call it `<GAME_B_ID>`).

---

## 3. Submitting Game Stats

The backend handles Game Type A and Type B differently. Type A expects a `rawScore`, while Type B expects a `timeTaken` which it converts into a standardized score automatically.

### Submit Stats for Game Type A
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/v1/games/<GAME_A_ID>/submit-stats`
* **Body (raw JSON):**
  ```json
  {
      "userId": "<YOUR_USER_ID>",
      "rawScore": 2500
  }
  ```
* **Expected Result:** The backend saves 2500 as the `finalScore`. If you submit a lower score later, it will keep the high score. (Returns `404 User not found` if `userId` is invalid).

### Submit Stats for Game Type B
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/v1/games/<GAME_B_ID>/submit-stats`
* **Body (raw JSON):**
  ```json
  {
      "userId": "<YOUR_USER_ID>",
      "timeTaken": 150
  }
  ```
* **Expected Result:** The backend will convert `timeTaken` into a score using the formula `10000 - (150 * 10)`. The resulting `finalScore` will be `8500`. If you submit a higher time (worse score), it preserves your best time. (Returns `404 User not found` if `userId` is invalid).

---

## 4. Leaderboards

### Global Leaderboard (Cumulative Score)
* **Method:** `GET`
* **URL:** `http://localhost:3000/api/v1/leaderboard/global`
* **Expected Result:** Returns a list of users sorted by the sum of their `finalScore` across **all** games they have played. So if `tester123` got 2500 on Game A and 8500 on Game B, their cumulative score here will be 11000.

### Game-Specific Leaderboard
* **Method:** `GET`
* **URL:** `http://localhost:3000/api/v1/leaderboard/<GAME_A_ID>` (or `<GAME_B_ID>`)
* **Expected Result:** Returns the top players for that specific game, sorted by `finalScore`.

