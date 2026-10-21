import hmac
import os
import jwt
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import Boolean, Integer, create_engine, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

JWT_SECRET = os.environ['JWT_SECRET']
SERVICE_TOKEN = os.environ['SERVICE_TOKEN']
if min(len(JWT_SECRET), len(SERVICE_TOKEN)) < 32:
    raise RuntimeError('Configure secrets with at least 32 characters')
engine = create_engine(os.environ['DATABASE_URL'], pool_pre_ping=True)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

class Base(DeclarativeBase):
    pass

class Tarefa(Base):
    __tablename__ = 'Tarefa'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuarioId: Mapped[int] = mapped_column(Integer)
    concluida: Mapped[bool] = mapped_column(Boolean)

@app.exception_handler(SQLAlchemyError)
async def database_error(request, error):
    return JSONResponse(status_code=503, content={'erro': 'Banco de dados indisponível'})

@app.get('/api/stats')
def stats(authorization: str = Header(default=''), x_service_token: str = Header(default='')):
    if not hmac.compare_digest(x_service_token.encode(), SERVICE_TOKEN.encode()):
        raise HTTPException(401, 'Serviço não autorizado')
    try:
        if not authorization.startswith('Bearer '):
            raise ValueError('Missing token')
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=['HS256'],
                             audience='todo-app', issuer='todo-api',
                             options={'require': ['sub', 'exp', 'iat', 'iss', 'aud']})
        user_id = int(payload['sub'])
        if user_id <= 0:
            raise ValueError('Invalid user')
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, 'Token inválido ou expirado')
    with Session(engine) as session:
        query = select(func.count(Tarefa.id), func.count(Tarefa.id).filter(Tarefa.concluida.is_(True))).where(Tarefa.usuarioId == user_id)
        total, completed = session.execute(query).one()
    return {'usuarioId': user_id, 'total': total, 'concluidas': completed, 'pendentes': total - completed}
