import express, { response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/extension.route.js';

dotenv.config();
const app = express();

app.use(
  cors({
    origin: '*', // Replace '*' with your frontend URL for security
  })
);
app.use(express.json());


app.use('/',router)


app.listen(3000, () =>
  console.log('✅ Server listening on http://localhost:3000')
);
