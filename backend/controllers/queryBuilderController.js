const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';

// Valid operators for query building
const VALID_OPERATORS = new Set([
    'equals', 'contains', 'starts_with', 'ends_with', 
    'is_null', 'is_not_null', 'greater_than', 'less_than',
    'between', 'before', 'after', 'in_list', 'not_in_list',
    'between_date'
]);

// Helper function to extract WHERE conditions from a query
const extractWhereConditions = (query) => {
    const whereMatch = query.match(/WHERE\s+(.*?)(?=(?:ORDER BY|GROUP BY|LIMIT|$))/is);
    return whereMatch ? whereMatch[1].trim() : 'TRUE';
};

// Build optimized combined query
const buildOptimizedCombinedQuery = (baseQuery, conditions, limit, offset) => {
    const whereConditions = extractWhereConditions(baseQuery);

    const optimizedQuery = `
        WITH base_stats AS (
            SELECT 
                COUNT(DISTINCT claim_id) as unique_claims,
                COUNT(*) as total_records,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date,
                SUM(COALESCE(allowed_amount, 0)) as total_amount
            FROM ${CLAIMS_TABLE}
            WHERE ${whereConditions}
        ),
        paginated_claims AS (
            ${baseQuery}
            LIMIT ${limit} 
            OFFSET ${offset}
        )
        SELECT 
            json_build_object(
                'uniqueClaimIds', (SELECT unique_claims FROM base_stats),
                'totalRecords', (SELECT total_records FROM base_stats),
                'dateRange', json_build_object(
                    'min', (SELECT min_date::text FROM base_stats),
                    'max', (SELECT max_date::text FROM base_stats)
                ),
                'totalAllowedAmount', (SELECT total_amount FROM base_stats)
            ) as statistics,
            COALESCE(
                (SELECT jsonb_agg(t) FROM paginated_claims t),
                '[]'::jsonb
            ) as claims
    `;

    return optimizedQuery;
};

// Build where clauses for query
const buildWhereClauses = (conditions) => {
    if (!conditions || !Array.isArray(conditions)) {
        return { clauses: [], params: [] };
    }

    const clauses = [];
    const params = [];

    conditions.forEach(condition => {
        const { column, operator, value, secondValue } = condition;
        
        if (value === null && !['is_null', 'is_not_null', 'between', 'between_date'].includes(operator)) {
            return;
        }

        if (!['is_null', 'is_not_null'].includes(operator)) {
            const getTypeCasting = (val) => {
                if (!isNaN(val) && typeof val !== 'boolean') {
                    return 'numeric';
                }
                if (operator === 'before' || operator === 'after' || operator === 'between' || operator === 'between_date') {
                    return 'timestamp';
                }
                return 'text';
            };

            switch(operator) {
                case 'equals':
                    params.push(value);
                    const valueType = getTypeCasting(value);
                    clauses.push(`${column}::${valueType} = $${params.length}::${valueType}`);
                    break;
                case 'contains':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE '%' || $${params.length}::text || '%'`);
                    break;
                case 'starts_with':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE $${params.length}::text || '%'`);
                    break;
                case 'ends_with':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE '%' || $${params.length}::text`);
                    break;
                case 'in_list':
                    const inListValues = String(value).split(/[,;\t|]/).map(v => v.trim()).filter(v => v.length > 0);
                    params.push(inListValues);
                    clauses.push(`LOWER(${column}::text) = ANY(SELECT LOWER(UNNEST($${params.length}::text[])))`);
                    break;
                case 'not_in_list':
                    const notInListValues = String(value).split(/[,;\t|]/).map(v => v.trim()).filter(v => v.length > 0);
                    params.push(notInListValues);
                    clauses.push(`LOWER(${column}::text) NOT IN (SELECT LOWER(UNNEST($${params.length}::text[])))`);
                    break;
                case 'greater_than':
                    params.push(value);
                    const gtType = getTypeCasting(value);
                    clauses.push(`${column}::${gtType} > $${params.length}::${gtType}`);
                    break;
                case 'less_than':
                    params.push(value);
                    const ltType = getTypeCasting(value);
                    clauses.push(`${column}::${ltType} < $${params.length}::${ltType}`);
                    break;
                case 'before':
                    params.push(value);
                    clauses.push(`${column}::date < $${params.length}::date`);
                    break;
                case 'after':
                    params.push(value);
                    clauses.push(`${column}::date > $${params.length}::date`);
                    break;
                case 'between':
                    if (value !== null && secondValue !== null) {
                        params.push(value, secondValue);
                        const betweenType = getTypeCasting(value);
                        clauses.push(`${column}::${betweenType} BETWEEN $${params.length - 1}::${betweenType} AND $${params.length}::${betweenType}`);
                    }
                    break;
                case 'between_date':
                    if (value && secondValue?.unit && secondValue?.value !== undefined) {
                        const { operator: compareOp, value: compareValue, unit } = secondValue;
                        let referenceDate;
                        
                        if (value === 'today') {
                            referenceDate = 'CURRENT_TIMESTAMP';
                        } else if (value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                            referenceDate = value;
                        } else {
                            params.push(value);
                            referenceDate = `$${params.length}::timestamp`;
                        }

                        let intervalCalc;
                        switch (unit) {
                            case 'year':
                                intervalCalc = `ABS(EXTRACT(YEAR FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)))`;
                                break;
                            case 'month':
                                intervalCalc = `ABS(EXTRACT(MONTH FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)) + 12 * EXTRACT(YEAR FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)))`;
                                break;
                            case 'week':
                                intervalCalc = `ABS(EXTRACT(EPOCH FROM (${referenceDate}::timestamp - ${column}::timestamp))/(86400*7))`;
                                break;
                            case 'day':
                                intervalCalc = `ABS(EXTRACT(EPOCH FROM (${referenceDate}::timestamp - ${column}::timestamp))/86400)`;
                                break;
                            default:
                                throw new Error(`Unsupported time unit: ${unit}`);
                        }
                        
                        let clause;
                        switch (compareOp) {
                            case 'greater_than':
                                clause = `${intervalCalc} > ${compareValue}`;
                                break;
                            case 'less_than':
                                clause = `${intervalCalc} < ${compareValue}`;
                                break;
                            case 'equals':
                                if (unit === 'week' || unit === 'day') {
                                    clause = `${intervalCalc} >= ${compareValue} AND ${intervalCalc} < ${compareValue + 1}`;
                                } else {
                                    clause = `${intervalCalc} = ${compareValue}`;
                                }
                                break;
                            default:
                                clause = 'TRUE';
                        }
                        
                        clauses.push(clause);
                    }
                    break;
            }
        } else {
            if (operator === 'is_null') {
                clauses.push(`${column} IS NULL`);
            } else {
                clauses.push(`${column} IS NOT NULL`);
            }
        }
    });
    
    return { clauses, params };
};

// Build filter query
const buildFilterQuery = (conditions) => {
    const { clauses, params } = buildWhereClauses(conditions);
    
    const query = `
        SELECT 
            c.claim_id,
            jsonb_agg(
                to_jsonb(c.*)
                ORDER BY c.line_id
            ) as grouped_data
        FROM ${CLAIMS_TABLE} c
        ${clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : ''}
        GROUP BY c.claim_id
    `;

    return { query, params };
};

// Build ID query
const buildIdQuery = (mainConditions, subKeyConditions) => {
    let query = `
        WITH matching_claims AS (
            SELECT DISTINCT c1.id
            FROM ${CLAIMS_TABLE} c1
    `;

    const mainWhere = buildWhereClauses(mainConditions);
    const subWhere = buildWhereClauses(subKeyConditions);
    
    let paramOffset = 0;
    let allParams = [];

    if (mainWhere.clauses.length) {
        const adjustedMainClauses = mainWhere.clauses.map(clause => {
            return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + paramOffset}`);
        });
        query += ` WHERE ${adjustedMainClauses.join(' AND ')}`;
        allParams = [...mainWhere.params];
        paramOffset = mainWhere.params.length;
    } else {
        query += ` WHERE TRUE`;
    }

    if (subWhere.clauses.length) {
        const adjustedSubClauses = subWhere.clauses.map(clause => {
            return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + paramOffset}`);
        });
        query += `
            AND EXISTS (
                SELECT 1
                FROM ${CLAIMS_TABLE} c2
                WHERE c2.claim_id = c1.claim_id
                AND ${adjustedSubClauses.join(' AND ')}
            )
        `;
        allParams = [...allParams, ...subWhere.params];
    }

    query += `) SELECT id FROM matching_claims`;

    return {
        query,
        params: allParams
    };
};

module.exports = {
    VALID_OPERATORS,
    buildOptimizedCombinedQuery,
    buildWhereClauses,
    buildFilterQuery,
    buildIdQuery,
    extractWhereConditions
}; 