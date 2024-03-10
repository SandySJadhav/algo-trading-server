import { NextFunction, Request, Response } from 'express';
import Firebase from './firebase/instance';
import { getISTTime } from './helpers';

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authorization } = req.headers;
    if (authorization) {
      const idToken = String(authorization).split(' ')?.[1];
      if (idToken) {
        // idToken comes from the client app
        const { exp } = await Firebase.auth.verifyIdToken(idToken);
        if (exp * 1000 > getISTTime().valueOf()) {
          // session is valid
          next();
        } else {
          console.log('Session expired');
          // Session Expired
          res.status(440).send({
            statusCode: 440,
            message: 'Session Expired!'
          });
        }
      } else {
        // Forbidden
        res.status(403).send({
          statusCode: 403,
          message: 'Unauthorized!'
        });
      }
    } else {
      // Forbidden
      res.status(403).send({
        statusCode: 403,
        message: 'Unauthorized!'
      });
    }
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      // Session Expired
      res.status(440).send({
        statusCode: 440,
        message: 'Session Expired!'
      });
    } else {
      // Forbidden
      res.status(403).send({
        statusCode: 403,
        message: 'Unauthorized!'
      });
    }
  }
};

export default verifyToken;
