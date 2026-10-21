import os
import time
import unittest
os.environ['JWT_SECRET'] = 'test-jwt-secret-' + 'a' * 32
os.environ['SERVICE_TOKEN'] = 'test-service-secret-' + 'b' * 32
os.environ['DATABASE_URL'] = 'sqlite://'
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
import app

class IsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        app.Base.metadata.create_all(app.engine)
        with Session(app.engine) as session:
            session.add_all([app.Tarefa(id=1, usuarioId=1, concluida=True), app.Tarefa(id=2, usuarioId=1, concluida=False), app.Tarefa(id=3, usuarioId=2, concluida=False)])
            session.commit()
        cls.client = TestClient(app.app)

    def headers(self, user=1, expires=3600, secret=None):
        token = jwt.encode({'sub': str(user), 'iat': int(time.time()), 'exp': int(time.time()) + expires, 'iss': 'todo-api', 'aud': 'todo-app'}, secret or app.JWT_SECRET, algorithm='HS256')
        return {'Authorization': 'Bearer ' + token, 'X-Service-Token': app.SERVICE_TOKEN}

    def test_isolation_and_forged_query(self):
        self.assertEqual(self.client.get('/api/stats?usuarioId=2', headers=self.headers()).json(), {'usuarioId': 1, 'total': 2, 'concluidas': 1, 'pendentes': 1})
        self.assertEqual(self.client.get('/api/stats', headers=self.headers(2)).json(), {'usuarioId': 2, 'total': 1, 'concluidas': 0, 'pendentes': 1})

    def test_empty_user(self):
        self.assertEqual(self.client.get('/api/stats', headers=self.headers(3)).json(), {'usuarioId': 3, 'total': 0, 'concluidas': 0, 'pendentes': 0})

    def test_missing_service_credential(self):
        headers = self.headers()
        del headers['X-Service-Token']
        self.assertEqual(self.client.get('/api/stats', headers=headers).status_code, 401)

    def test_invalid_and_expired_tokens(self):
        for headers in [self.headers(expires=-60), self.headers(secret='wrong-secret-' * 4), {'X-Service-Token': app.SERVICE_TOKEN}]:
            self.assertEqual(self.client.get('/api/stats', headers=headers).status_code, 401)

if __name__ == '__main__':
    unittest.main()
