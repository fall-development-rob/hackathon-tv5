# Makefile for Media Gateway Docker Compose Operations
# Provides convenient commands for managing the Docker stack

.PHONY: help setup up down restart logs ps clean backup restore db-shell db-init test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)Media Gateway - Docker Compose Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(GREEN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

setup: ## Initial setup - copy .env.example to .env
	@echo "$(YELLOW)Setting up environment...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env file from .env.example$(NC)"; \
		echo "$(YELLOW)⚠ Please edit .env and update credentials before starting services$(NC)"; \
	else \
		echo "$(YELLOW)⚠ .env file already exists$(NC)"; \
	fi
	@mkdir -p backups/postgres
	@mkdir -p config/postgres/init
	@mkdir -p config/pgadmin
	@echo "$(GREEN)✓ Setup complete$(NC)"

##@ Service Management

up: ## Start all services (PostgreSQL only)
	@echo "$(YELLOW)Starting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@$(MAKE) ps

up-admin: ## Start services with pgAdmin
	@echo "$(YELLOW)Starting services with pgAdmin...$(NC)"
	docker-compose --profile admin up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@echo "$(BLUE)pgAdmin: http://localhost:5050$(NC)"
	@$(MAKE) ps

up-full: ## Start all services (PostgreSQL + pgAdmin + Redis)
	@echo "$(YELLOW)Starting full stack...$(NC)"
	docker-compose --profile admin --profile cache up -d
	@echo "$(GREEN)✓ Full stack started$(NC)"
	@echo "$(BLUE)pgAdmin: http://localhost:5050$(NC)"
	@$(MAKE) ps

down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

down-volumes: ## Stop services and remove volumes (WARNING: deletes all data)
	@echo "$(RED)⚠ WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)✓ Services and volumes removed$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

restart: ## Restart all services
	@echo "$(YELLOW)Restarting services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

restart-db: ## Restart PostgreSQL service only
	@echo "$(YELLOW)Restarting PostgreSQL...$(NC)"
	docker-compose restart ruvector-postgres
	@echo "$(GREEN)✓ PostgreSQL restarted$(NC)"

##@ Monitoring

ps: ## Show running services
	@docker-compose ps

logs: ## Show logs for all services
	docker-compose logs -f

logs-db: ## Show PostgreSQL logs
	docker-compose logs -f ruvector-postgres

logs-tail: ## Show last 100 lines of logs
	docker-compose logs --tail=100

stats: ## Show resource usage statistics
	@docker stats --no-stream

health: ## Check health of all services
	@echo "$(BLUE)Service Health Status:$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(BLUE)PostgreSQL Health:$(NC)"
	@docker-compose exec -T ruvector-postgres pg_isready || echo "$(RED)PostgreSQL not ready$(NC)"

##@ Database Operations

db-shell: ## Open PostgreSQL shell
	@echo "$(BLUE)Connecting to PostgreSQL...$(NC)"
	docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway

db-init: ## Initialize database with sample data
	@echo "$(YELLOW)Initializing database...$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < config/postgres/init/01-init-vector-extensions.sql
	@echo "$(GREEN)✓ Database initialized$(NC)"

db-test: ## Test database connection
	@echo "$(BLUE)Testing database connection...$(NC)"
	@docker-compose exec -T ruvector-postgres pg_isready -U mediagateway -d media_gateway && \
		echo "$(GREEN)✓ Database connection successful$(NC)" || \
		echo "$(RED)✗ Database connection failed$(NC)"

db-size: ## Show database size
	@echo "$(BLUE)Database Size:$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway -c "SELECT pg_size_pretty(pg_database_size('media_gateway'));"

db-tables: ## List all tables
	@echo "$(BLUE)Tables in database:$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway -c "\dt *.* "

db-schemas: ## List all schemas
	@echo "$(BLUE)Schemas in database:$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway -c "\dn+"

db-extensions: ## List installed extensions
	@echo "$(BLUE)Installed extensions:$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway -c "\dx"

##@ Backup & Restore

backup: ## Create database backup
	@echo "$(YELLOW)Creating backup...$(NC)"
	@mkdir -p backups/postgres
	@BACKUP_FILE="backups/postgres/backup-$$(date +%Y%m%d-%H%M%S).sql"; \
	docker-compose exec -T ruvector-postgres pg_dump -U mediagateway media_gateway > $$BACKUP_FILE && \
		echo "$(GREEN)✓ Backup created: $$BACKUP_FILE$(NC)" || \
		echo "$(RED)✗ Backup failed$(NC)"

backup-custom: ## Create custom format backup (compressed)
	@echo "$(YELLOW)Creating custom format backup...$(NC)"
	@mkdir -p backups/postgres
	@BACKUP_FILE="backups/postgres/backup-$$(date +%Y%m%d-%H%M%S).dump"; \
	docker-compose exec -T ruvector-postgres pg_dump -U mediagateway -Fc media_gateway > $$BACKUP_FILE && \
		echo "$(GREEN)✓ Backup created: $$BACKUP_FILE$(NC)" || \
		echo "$(RED)✗ Backup failed$(NC)"

restore: ## Restore from latest backup (requires BACKUP_FILE variable)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Error: BACKUP_FILE not specified$(NC)"; \
		echo "Usage: make restore BACKUP_FILE=backups/postgres/backup-20240101-120000.sql"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring from $(BACKUP_FILE)...$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < $(BACKUP_FILE) && \
		echo "$(GREEN)✓ Restore completed$(NC)" || \
		echo "$(RED)✗ Restore failed$(NC)"

list-backups: ## List available backups
	@echo "$(BLUE)Available backups:$(NC)"
	@ls -lh backups/postgres/ 2>/dev/null || echo "No backups found"

##@ Maintenance

clean: ## Clean up Docker resources (keeps volumes)
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker-compose down
	docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-volumes: ## Clean up everything including volumes (WARNING: deletes data)
	@echo "$(RED)⚠ WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		docker system prune -f; \
		echo "$(GREEN)✓ Complete cleanup done$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

reset: ## Reset everything and start fresh
	@echo "$(RED)⚠ WARNING: This will delete all data and reset the environment!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(MAKE) down-volumes; \
		rm -f .env; \
		$(MAKE) setup; \
		echo "$(GREEN)✓ Reset complete. Edit .env and run 'make up'$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

##@ Development

dev: ## Start development environment (full stack)
	@$(MAKE) setup
	@$(MAKE) up-full
	@echo "$(GREEN)✓ Development environment ready$(NC)"
	@echo "$(BLUE)Services:$(NC)"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  pgAdmin: http://localhost:5050"
	@echo "  Redis: localhost:6379"

test-vector: ## Test vector search functionality
	@echo "$(BLUE)Testing vector search...$(NC)"
	@docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway -c "\
		SELECT \
			'vector extension' as test, \
			CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status \
		FROM pg_extension WHERE extname = 'vector';"

shell-postgres: ## Open shell in PostgreSQL container
	docker-compose exec ruvector-postgres /bin/bash

shell-redis: ## Open shell in Redis container (if running)
	docker-compose exec redis /bin/sh

##@ Information

info: ## Display system information
	@echo "$(BLUE)System Information:$(NC)"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$(docker-compose --version)"
	@echo ""
	@echo "$(BLUE)Project Status:$(NC)"
	@if [ -f .env ]; then echo "$(GREEN)✓ .env configured$(NC)"; else echo "$(RED)✗ .env not found - run 'make setup'$(NC)"; fi
	@echo ""
	@$(MAKE) ps

env: ## Show current environment configuration
	@if [ -f .env ]; then \
		echo "$(BLUE)Current Environment Configuration:$(NC)"; \
		grep -v '^#' .env | grep -v '^$$' | grep 'POSTGRES\|REDIS\|PGADMIN' || true; \
	else \
		echo "$(RED).env file not found$(NC)"; \
	fi

urls: ## Display service URLs
	@echo "$(BLUE)Service URLs:$(NC)"
	@echo "PostgreSQL: postgresql://mediagateway:<password>@localhost:5432/media_gateway"
	@echo "pgAdmin: http://localhost:5050"
	@echo "Redis: redis://localhost:6379"
