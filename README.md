# Roll Together REST API

This is the backend REST API for [Roll Together](https://github.com/joepotenza/rolltogether), a platform for finding and collaborating with tabletop gaming groups.

## Technologies Used

- Node.js
- Express
- MongoDB
- [Mongoose](https://github.com/Automattic/mongoose) for MongoDB
- [BCrypt](https://github.com/kelektiv/node.bcrypt.js) for password encryption
- [Celebrate/Joi](https://github.com/arb/celebrate) for data validation
- [Winston](https://github.com/winstonjs/winston) for logging
- [Google-Auth-Library](https://github.com/googleapis/google-cloud-node-core) for OAuth2 integration
- [Mailgun.js](https://github.com/mailgun/mailgun.js) for email delivery
- [Helmet](https://github.com/helmetjs/helmet) for enhanced security

## Environment Variables

This code relies on a `.env` variable for API keys and for encoding JSON Web Tokens. For security purposes they can not be shared but these are the variables it expects:

```
PORT=3001
MONGO_URI=mongodb://localhost:27017/rolltogether_db
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_SENDER=
```
