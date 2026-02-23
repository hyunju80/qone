
from pydantic import BaseModel
from typing import List, Any, Optional
import json

# Mirroring models from scenarios.py
class TestCase(BaseModel):
    id: str = None
    title: str
    preCondition: str
    inputData: str
    steps: List[str]
    expectedResult: str
    status: str = "draft"

class CreateScenarioRequest(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    testCases: List[TestCase]
    persona_id: str
    is_approved: bool = True
    created_at: Any = None
    tags: List[str] = []

# Mock Payload matches ScenarioGenerator.tsx logic
payload = {
  "id": "scen_123456",
  "project_id": "proj_abc",
  "title": "Test Scenario",
  "description": "",
  "testCases": [
    {
      "id": "tc_0_0",
      "title": "Login Test",
      "preCondition": "User logged out",
      "inputData": "user/pass",
      "steps": ["Click login", "Enter user", "Enter pass", "Submit"],
      "expectedResult": "Dashboard shown",
      "status": "draft"
    }
  ],
  "persona_id": "persona_1",
  "is_approved": True,
  "tags": []
}

try:
    req = CreateScenarioRequest(**payload)
    print("Validation Successful")
except Exception as e:
    print(f"Validation Error: {e}")
