-- AIBiz Agent Harness persistence baseline.
-- Target database: plm, MySQL 5.7.
-- This migration is intentionally independent from the generated model export.

CREATE TABLE IF NOT EXISTS `AI_RUN` (
  `ID` varchar(100) NOT NULL COMMENT '标识',
  `NAME` varchar(200) DEFAULT NULL COMMENT '名称',
  `CREATE_MAN` varchar(100) NOT NULL COMMENT '创建人',
  `CREATE_TIME` datetime NOT NULL COMMENT '创建时间',
  `UPDATE_MAN` varchar(100) NOT NULL COMMENT '更新人',
  `UPDATE_TIME` datetime NOT NULL COMMENT '更新时间',
  `STATUS` varchar(60) NOT NULL DEFAULT 'queued' COMMENT '运行状态',
  `RUN_TYPE` varchar(60) NOT NULL COMMENT '运行类型',
  `TENANT_ID` varchar(100) NOT NULL COMMENT '租户标识',
  `USER_ID` varchar(100) NOT NULL COMMENT '用户标识',
  `PROJECT_ID` varchar(100) DEFAULT NULL COMMENT '项目标识',
  `AGENT_ID` varchar(100) NOT NULL COMMENT '智能体标识',
  `AGENT_VERSION` varchar(100) DEFAULT NULL COMMENT '智能体版本',
  `MODEL_ID` varchar(100) NOT NULL COMMENT '模型标识',
  `PROVIDER` varchar(100) DEFAULT NULL COMMENT '提供商',
  `CONTEXT_ID` varchar(100) DEFAULT NULL COMMENT '上下文标识',
  `CONVERSATION_ID` varchar(100) DEFAULT NULL COMMENT '会话标识',
  `SESSION_ID` varchar(200) DEFAULT NULL COMMENT '会话外部标识',
  `PARENT_RUN_ID` varchar(100) DEFAULT NULL COMMENT '父运行标识',
  `IDEMPOTENCY_KEY` varchar(200) NOT NULL COMMENT '幂等键',
  `TRACE_ID` varchar(200) NOT NULL COMMENT '追踪标识',
  `WORKSPACE` varchar(1000) DEFAULT NULL COMMENT '工作区',
  `REQUEST_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '请求摘要',
  `RESULT_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '结果摘要',
  `ERROR_CODE` varchar(100) DEFAULT NULL COMMENT '错误码',
  `ERROR_MESSAGE` varchar(1000) DEFAULT NULL COMMENT '错误摘要',
  `BUDGET_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '预算摘要',
  `DEADLINE_AT` datetime DEFAULT NULL COMMENT '截止时间',
  `LEASE_OWNER` varchar(200) DEFAULT NULL COMMENT '租约持有者',
  `LEASE_UNTIL` datetime DEFAULT NULL COMMENT '租约截止时间',
  `RECOVERY_ATTEMPTS` int(11) NOT NULL DEFAULT 0 COMMENT '恢复尝试次数',
  `NEXT_ATTEMPT_AT` datetime DEFAULT NULL COMMENT '下次尝试时间',
  `STARTED_AT` datetime DEFAULT NULL COMMENT '开始时间',
  `FINISHED_AT` datetime DEFAULT NULL COMMENT '结束时间',
  `LAST_EVENT_SEQUENCE` bigint(20) NOT NULL DEFAULT 0 COMMENT '最后事件序号',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='AI Harness运行';

CREATE TABLE IF NOT EXISTS `AI_RUN_STEP` (
  `ID` varchar(100) NOT NULL COMMENT '标识',
  `NAME` varchar(200) DEFAULT NULL COMMENT '名称',
  `CREATE_MAN` varchar(100) NOT NULL COMMENT '创建人',
  `CREATE_TIME` datetime NOT NULL COMMENT '创建时间',
  `UPDATE_MAN` varchar(100) NOT NULL COMMENT '更新人',
  `UPDATE_TIME` datetime NOT NULL COMMENT '更新时间',
  `RUN_ID` varchar(100) NOT NULL COMMENT '运行标识',
  `SEQUENCE` bigint(20) NOT NULL COMMENT '步骤序号',
  `ATTEMPT` int(11) NOT NULL DEFAULT 0 COMMENT '尝试次数',
  `STEP_KIND` varchar(60) NOT NULL COMMENT '步骤类型',
  `STATUS` varchar(60) NOT NULL DEFAULT 'queued' COMMENT '步骤状态',
  `INPUT_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '输入摘要',
  `OUTPUT_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '输出摘要',
  `TOOL_NAME` varchar(200) DEFAULT NULL COMMENT '工具名称',
  `TOOL_CALL_ID` varchar(200) DEFAULT NULL COMMENT '工具调用标识',
  `IDEMPOTENCY_KEY` varchar(200) NOT NULL COMMENT '幂等键',
  `RETRY_COUNT` int(11) NOT NULL DEFAULT 0 COMMENT '重试次数',
  `ERROR_CODE` varchar(100) DEFAULT NULL COMMENT '错误码',
  `ERROR_MESSAGE` varchar(1000) DEFAULT NULL COMMENT '错误摘要',
  `STARTED_AT` datetime DEFAULT NULL COMMENT '开始时间',
  `FINISHED_AT` datetime DEFAULT NULL COMMENT '结束时间',
  `DURATION_MS` bigint(20) DEFAULT NULL COMMENT '耗时毫秒',
  `LAST_EVENT_SEQUENCE` bigint(20) NOT NULL DEFAULT 0 COMMENT '最后事件序号',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='AI Harness运行步骤';

CREATE TABLE IF NOT EXISTS `AI_RUN_EVENT` (
  `ID` varchar(100) NOT NULL COMMENT '标识',
  `NAME` varchar(200) DEFAULT NULL COMMENT '名称',
  `CREATE_MAN` varchar(100) NOT NULL COMMENT '创建人',
  `CREATE_TIME` datetime NOT NULL COMMENT '创建时间',
  `UPDATE_MAN` varchar(100) NOT NULL COMMENT '更新人',
  `UPDATE_TIME` datetime NOT NULL COMMENT '更新时间',
  `RUN_ID` varchar(100) NOT NULL COMMENT '运行标识',
  `STEP_ID` varchar(100) DEFAULT NULL COMMENT '步骤标识',
  `SEQUENCE` bigint(20) NOT NULL COMMENT '事件序号',
  `EVENT_TYPE` varchar(100) NOT NULL COMMENT '事件类型',
  `AGGREGATE_VERSION` bigint(20) NOT NULL DEFAULT 1 COMMENT '聚合版本',
  `IDEMPOTENCY_KEY` varchar(300) NOT NULL COMMENT '幂等键',
  `ACTOR_TYPE` varchar(60) NOT NULL COMMENT '操作者类型',
  `ACTOR_ID` varchar(100) DEFAULT NULL COMMENT '操作者标识',
  `TRACE_ID` varchar(200) NOT NULL COMMENT '追踪标识',
  `OCCURRED_AT` datetime NOT NULL COMMENT '发生时间',
  `PAYLOAD_JSON` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '事件载荷',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='AI Harness运行事件';

DELIMITER //

DROP PROCEDURE IF EXISTS `aibiz_add_harness_column_if_missing`//

CREATE PROCEDURE `aibiz_add_harness_column_if_missing`(
  IN p_table_name varchar(64),
  IN p_column_name varchar(64),
  IN p_column_sql varchar(1000)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @aibiz_harness_column_sql = p_column_sql;
    PREPARE aibiz_harness_column_stmt FROM @aibiz_harness_column_sql;
    EXECUTE aibiz_harness_column_stmt;
    DEALLOCATE PREPARE aibiz_harness_column_stmt;
  END IF;
END//

DELIMITER ;

CALL `aibiz_add_harness_column_if_missing`(
  'AI_RUN',
  'LEASE_OWNER',
  'ALTER TABLE `AI_RUN` ADD COLUMN `LEASE_OWNER` varchar(200) DEFAULT NULL COMMENT ''租约持有者'''
);
CALL `aibiz_add_harness_column_if_missing`(
  'AI_RUN',
  'LEASE_UNTIL',
  'ALTER TABLE `AI_RUN` ADD COLUMN `LEASE_UNTIL` datetime DEFAULT NULL COMMENT ''租约截止时间'''
);
CALL `aibiz_add_harness_column_if_missing`(
  'AI_RUN',
  'RECOVERY_ATTEMPTS',
  'ALTER TABLE `AI_RUN` ADD COLUMN `RECOVERY_ATTEMPTS` int(11) NOT NULL DEFAULT 0 COMMENT ''恢复尝试次数'''
);
CALL `aibiz_add_harness_column_if_missing`(
  'AI_RUN',
  'NEXT_ATTEMPT_AT',
  'ALTER TABLE `AI_RUN` ADD COLUMN `NEXT_ATTEMPT_AT` datetime DEFAULT NULL COMMENT ''下次尝试时间'''
);

DROP PROCEDURE `aibiz_add_harness_column_if_missing`;

DELIMITER //

DROP PROCEDURE IF EXISTS `aibiz_add_harness_index_if_missing`//

CREATE PROCEDURE `aibiz_add_harness_index_if_missing`(
  IN p_table_name varchar(64),
  IN p_index_name varchar(64),
  IN p_index_sql varchar(1000)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @aibiz_harness_index_sql = p_index_sql;
    PREPARE aibiz_harness_index_stmt FROM @aibiz_harness_index_sql;
    EXECUTE aibiz_harness_index_stmt;
    DEALLOCATE PREPARE aibiz_harness_index_stmt;
  END IF;
END//

DELIMITER ;

CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'UK_AI_RUN_TENANT_IDEMPOTENCY',
  'ALTER TABLE `AI_RUN` ADD UNIQUE KEY `UK_AI_RUN_TENANT_IDEMPOTENCY` (`TENANT_ID`, `IDEMPOTENCY_KEY`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'IX_AI_RUN_TENANT_USER_CREATE',
  'ALTER TABLE `AI_RUN` ADD KEY `IX_AI_RUN_TENANT_USER_CREATE` (`TENANT_ID`, `USER_ID`, `CREATE_TIME`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'IX_AI_RUN_CONVERSATION_CREATE',
  'ALTER TABLE `AI_RUN` ADD KEY `IX_AI_RUN_CONVERSATION_CREATE` (`CONVERSATION_ID`, `CREATE_TIME`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'IX_AI_RUN_STATUS_DEADLINE_UPDATE',
  'ALTER TABLE `AI_RUN` ADD KEY `IX_AI_RUN_STATUS_DEADLINE_UPDATE` (`STATUS`, `DEADLINE_AT`, `UPDATE_TIME`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'IX_AI_RUN_RECOVERY_CANDIDATE',
  'ALTER TABLE `AI_RUN` ADD KEY `IX_AI_RUN_RECOVERY_CANDIDATE` (`STATUS`, `NEXT_ATTEMPT_AT`, `LEASE_UNTIL`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN',
  'IX_AI_RUN_PARENT_CREATE',
  'ALTER TABLE `AI_RUN` ADD KEY `IX_AI_RUN_PARENT_CREATE` (`PARENT_RUN_ID`, `CREATE_TIME`)'
);

CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_STEP',
  'UK_AI_RUN_STEP_RUN_SEQUENCE',
  'ALTER TABLE `AI_RUN_STEP` ADD UNIQUE KEY `UK_AI_RUN_STEP_RUN_SEQUENCE` (`RUN_ID`, `SEQUENCE`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_STEP',
  'UK_AI_RUN_STEP_RUN_IDEMPOTENCY',
  'ALTER TABLE `AI_RUN_STEP` ADD UNIQUE KEY `UK_AI_RUN_STEP_RUN_IDEMPOTENCY` (`RUN_ID`, `IDEMPOTENCY_KEY`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_STEP',
  'IX_AI_RUN_STEP_RUN_SEQUENCE',
  'ALTER TABLE `AI_RUN_STEP` ADD KEY `IX_AI_RUN_STEP_RUN_SEQUENCE` (`RUN_ID`, `SEQUENCE`)'
);

CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_EVENT',
  'UK_AI_RUN_EVENT_RUN_SEQUENCE',
  'ALTER TABLE `AI_RUN_EVENT` ADD UNIQUE KEY `UK_AI_RUN_EVENT_RUN_SEQUENCE` (`RUN_ID`, `SEQUENCE`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_EVENT',
  'UK_AI_RUN_EVENT_RUN_IDEMPOTENCY',
  'ALTER TABLE `AI_RUN_EVENT` ADD UNIQUE KEY `UK_AI_RUN_EVENT_RUN_IDEMPOTENCY` (`RUN_ID`, `IDEMPOTENCY_KEY`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_EVENT',
  'IX_AI_RUN_EVENT_RUN_SEQUENCE',
  'ALTER TABLE `AI_RUN_EVENT` ADD KEY `IX_AI_RUN_EVENT_RUN_SEQUENCE` (`RUN_ID`, `SEQUENCE`)'
);
CALL `aibiz_add_harness_index_if_missing`(
  'AI_RUN_EVENT',
  'IX_AI_RUN_EVENT_STEP_SEQUENCE',
  'ALTER TABLE `AI_RUN_EVENT` ADD KEY `IX_AI_RUN_EVENT_STEP_SEQUENCE` (`STEP_ID`, `SEQUENCE`)'
);

DROP PROCEDURE `aibiz_add_harness_index_if_missing`;
