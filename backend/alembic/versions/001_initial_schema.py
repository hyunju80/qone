"""Initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-03-?? 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CustomerAccount
    op.create_table('customeraccount',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_name', sa.String(), nullable=False),
        sa.Column('business_number', sa.String(), nullable=True),
        sa.Column('plan', sa.String(), nullable=True),
        sa.Column('billing_email', sa.String(), nullable=True),
        sa.Column('admin_email', sa.String(), nullable=True),
        sa.Column('usage', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customeraccount_business_number'), 'customeraccount', ['business_number'], unique=True)
    op.create_index(op.f('ix_customeraccount_id'), 'customeraccount', ['id'], unique=False)

    # User
    op.create_table('user',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('customer_account_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('is_saas_super_admin', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['customer_account_id'], ['customeraccount.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.create_index(op.f('ix_user_id'), 'user', ['id'], unique=False)

    # Project
    op.create_table('project',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('customer_account_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('domain', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('target_devices', sa.JSON(), nullable=True),
        sa.Column('environments', sa.JSON(), nullable=True),
        sa.Column('object_repo', sa.JSON(), nullable=True),
        sa.Column('mobile_config', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['customer_account_id'], ['customeraccount.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_project_id'), 'project', ['id'], unique=False)

    # ProjectAccess
    op.create_table('projectaccess',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('access_role', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projectaccess_id'), 'projectaccess', ['id'], unique=False)

    # Persona
    op.create_table('persona',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('traits', sa.JSON(), nullable=True),
        sa.Column('skill_level', sa.String(), nullable=True),
        sa.Column('speed', sa.String(), nullable=True),
        sa.Column('goal', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('advanced_logic', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_persona_id'), 'persona', ['id'], unique=False)

    # Device
    op.create_table('device',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('alias', sa.String(), nullable=True),
        sa.Column('protocol', sa.String(), nullable=True),
        sa.Column('os', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('specs', sa.JSON(), nullable=True),
        sa.Column('current_project', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_device_id'), 'device', ['id'], unique=False)

    # TestScript
    op.create_table('testscript',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('run_count', sa.Integer(), nullable=True),
        sa.Column('success_rate', sa.Float(), nullable=True),
        sa.Column('code', sa.Text(), nullable=True),
        sa.Column('origin', sa.String(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('is_favorite', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('persona_id', sa.String(), nullable=True),
        sa.Column('dataset', sa.JSON(), nullable=True),
        sa.Column('engine', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_testscript_id'), 'testscript', ['id'], unique=False)

    # Scenario
    op.create_table('scenario',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('test_cases', sa.JSON(), nullable=True),
        sa.Column('persona_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['persona_id'], ['persona.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scenario_id'), 'scenario', ['id'], unique=False)

    # TestSchedule
    op.create_table('testschedule',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('cron_expression', sa.String(), nullable=True),
        sa.Column('frequency_label', sa.String(), nullable=True),
        sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_run', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('alert_config', sa.JSON(), nullable=True),
        sa.Column('priority', sa.String(), nullable=True),
        sa.Column('trigger_strategy', sa.String(), nullable=True),
        sa.Column('incident_history', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_testschedule_id'), 'testschedule', ['id'], unique=False)

    # TestHistory
    op.create_table('testhistory',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('script_id', sa.String(), nullable=True),
        sa.Column('script_name', sa.String(), nullable=True),
        sa.Column('run_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('duration', sa.String(), nullable=True),
        sa.Column('persona_name', sa.String(), nullable=True),
        sa.Column('trigger', sa.String(), nullable=True),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('ai_summary', sa.String(), nullable=True),
        sa.Column('logs', sa.JSON(), nullable=True),
        sa.Column('deployment_version', sa.String(), nullable=True),
        sa.Column('commit_hash', sa.String(), nullable=True),
        sa.Column('schedule_id', sa.String(), nullable=True),
        sa.Column('schedule_name', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['schedule_id'], ['testschedule.id'], ),
        sa.ForeignKeyConstraint(['script_id'], ['testscript.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_testhistory_id'), 'testhistory', ['id'], unique=False)

    # ScheduleScript
    op.create_table('schedulescript',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.String(), nullable=True),
        sa.Column('script_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['schedule_id'], ['testschedule.id'], ),
        sa.ForeignKeyConstraint(['script_id'], ['testscript.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedulescript_id'), 'schedulescript', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_schedulescript_id'), table_name='schedulescript')
    op.drop_table('schedulescript')
    op.drop_index(op.f('ix_testhistory_id'), table_name='testhistory')
    op.drop_table('testhistory')
    op.drop_index(op.f('ix_testschedule_id'), table_name='testschedule')
    op.drop_table('testschedule')
    op.drop_index(op.f('ix_scenario_id'), table_name='scenario')
    op.drop_table('scenario')
    op.drop_index(op.f('ix_testscript_id'), table_name='testscript')
    op.drop_table('testscript')
    op.drop_index(op.f('ix_device_id'), table_name='device')
    op.drop_table('device')
    op.drop_index(op.f('ix_persona_id'), table_name='persona')
    op.drop_table('persona')
    op.drop_index(op.f('ix_projectaccess_id'), table_name='projectaccess')
    op.drop_table('projectaccess')
    op.drop_index(op.f('ix_project_id'), table_name='project')
    op.drop_table('project')
    op.drop_index(op.f('ix_user_id'), table_name='user')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')
    op.drop_index(op.f('ix_customeraccount_id'), table_name='customeraccount')
    op.drop_index(op.f('ix_customeraccount_business_number'), table_name='customeraccount')
    op.drop_table('customeraccount')
