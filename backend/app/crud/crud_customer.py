from app.crud.base import CRUDBase
from app.models.user import CustomerAccount
from app.schemas.customer import CustomerCreate, CustomerUpdate

class CRUDCustomer(CRUDBase[CustomerAccount, CustomerCreate, CustomerUpdate]):
    pass

customer = CRUDCustomer(CustomerAccount)
