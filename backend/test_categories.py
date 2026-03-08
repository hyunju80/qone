from app.schemas.project import ProjectInDBBase
from datetime import datetime
import json

data1 = {
    'id': 'test1',
    'customer_account_id': 'test',
    'created_at': datetime.now(),
    'categories': ['Common']
}

try:
    p1 = ProjectInDBBase(**data1)
    print('Dict with List:', p1.categories)
except Exception as e:
    print('Failed list:', e)

data2 = {
    'id': 'test2',
    'customer_account_id': 'test',
    'created_at': datetime.now(),
    'categories': '["Common"]'
}

try:
    p2 = ProjectInDBBase(**data2)
    print('Dict with String:', p2.categories)
except Exception as e:
    print('Failed string:', e)
