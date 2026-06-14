# memaster Python SDK

Python client for the Memaster cloud memory API.

## Install

```bash
pip install memaster
```

## Usage

```python
from memaster import MemoryClient

client = MemoryClient(api_key="m0sk_xxx")

client.add(
    user_id="user_123",
    messages=[{"role": "user", "content": "我喜欢中文回复"}],
)

results = client.search(
    query="用户偏好什么回复语言？",
    user_id="user_123",
    top_k=5,
)
```
