# Basic Microservices Demo

A small Node.js and Express demo with separate User and Order services. Each service uses its own MongoDB database; the Order Service verifies a user by calling the User Service over HTTP before saving an order.

## Requirements

- Node.js 18 or later
- MongoDB running locally, or a MongoDB connection URI

## Setup

In separate terminals, from the project root:

```powershell
Copy-Item user-service\.env.example user-service\.env
Copy-Item order-service\.env.example order-service\.env
cd user-service
npm install
npm start
```

In a second terminal:

```powershell
cd order-service
npm install
npm start
```

Update each `.env` file if MongoDB is not available at `mongodb://localhost:27017`. The User Service listens on port `3001`; the Order Service listens on port `3002`.

## API

### Create a user

`POST http://localhost:3001/users`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

Copy the returned `_id` for the order request. Email addresses must be unique.

### Create an order

`POST http://localhost:3002/orders`

```json
{
  "userId": "PASTE_THE_USER_ID_HERE",
  "productName": "Mechanical Keyboard",
  "price": 120
}
```

The service returns `400` with `Cannot create order: User does not exist.` if the referenced user is not found. It returns `503` if the User Service cannot be reached.

### List a user's orders

`GET http://localhost:3002/orders/user/USER_ID`

Both services also expose `GET /health`.

## Tests

The integration tests start the services on temporary ports and use isolated MongoDB databases. Make sure MongoDB is running, then run:

```powershell
cd user-service
npm test
```

In a second terminal, run the Order Service tests (they start both services for the end-to-end flow):

```powershell
cd order-service
npm test
```

Set `TEST_MONGO_URI` to use a non-default MongoDB server for tests. The tests create and remove databases with unique names; do not point `TEST_MONGO_URI` at a production database.
