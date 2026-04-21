from rq import Worker, Queue, Connection
import redis
import os

os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"

if __name__ == "__main__":
    conn = redis.Redis(host='localhost', port=6379)
    with Connection(conn):
        w = Worker(Queue('default', connection=conn))
        w.work()