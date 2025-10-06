import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@db:5432/road_damage')

async def run_sql_file(path: str):
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        with open(path, 'r') as f:
            sql = f.read()
            try:
                # exec_driver_sql sends the SQL directly to the DB driver and
                # can handle multiple statements in the script.
                await conn.exec_driver_sql(sql)
            except Exception:
                # If something goes wrong, re-raise after letting the context
                # rollback and logging will be visible in container logs.
                raise
    await engine.dispose()

if __name__ == '__main__':
    sql_path = os.path.join(os.path.dirname(__file__), '..', 'migrations', 'init_schema.sql')
    loop = asyncio.get_event_loop()
    loop.run_until_complete(run_sql_file(sql_path))
