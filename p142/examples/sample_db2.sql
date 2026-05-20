-- Sample DB2 DDL
CREATE TABLE employees (
    emp_id INTEGER GENERATED ALWAYS AS IDENTITY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    birth_date DATE,
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT TIMESTAMP
) ORGANIZE BY ROW;

CREATE UNIQUE INDEX idx_emp_email ON employees(email);

-- Sample DML
SELECT emp_id, first_name, last_name, hire_date
FROM employees
WHERE hire_date > '2020-01-01'
FETCH FIRST 10 ROWS ONLY
WITH UR;

SELECT NVL(email, 'no-email@example.com')
FROM employees
WHERE emp_id = 1;

INSERT INTO employees (first_name, last_name, hire_date, salary)
VALUES ('John', 'Doe', CURRENT DATE, 50000.00);

-- Sample Stored Procedure
CREATE PROCEDURE get_employee_salary(IN p_emp_id INTEGER, OUT p_salary DECIMAL(10,2))
LANGUAGE SQL
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET p_salary = 0;

    SELECT salary INTO p_salary
    FROM employees
    WHERE emp_id = p_emp_id;
END
@

-- Cursor WITH RETURN (returns result set to caller)
CREATE PROCEDURE get_employees_by_dept(IN p_dept_id INTEGER)
LANGUAGE SQL
BEGIN
    DECLARE emp_cursor CURSOR WITH RETURN TO CALLER FOR
        SELECT emp_id, first_name, last_name, salary
        FROM employees
        WHERE dept_id = p_dept_id;

    OPEN emp_cursor;
END
@

-- Cursor WITHOUT RETURN (local cursor)
CREATE PROCEDURE process_employees()
LANGUAGE SQL
BEGIN
    DECLARE v_emp_id INTEGER;
    DECLARE v_salary DECIMAL(10,2);
    DECLARE end_of_data INTEGER DEFAULT 0;

    DECLARE emp_cursor CURSOR WITHOUT RETURN FOR
        SELECT emp_id, salary FROM employees;

    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET end_of_data = 1;

    OPEN emp_cursor;

    FETCH emp_cursor INTO v_emp_id, v_salary;
END
@

-- Trigger with REFERENCING OLD/NEW AS
CREATE TRIGGER update_emp_timestamp
NO BEFORE UPDATE ON employees
REFERENCING OLD AS old_row NEW AS new_row
FOR EACH ROW MODE DB2SQL
BEGIN
    SET new_row.created_at = CURRENT TIMESTAMP;
END
@

-- Another trigger example
CREATE TRIGGER emp_salary_check
BEFORE INSERT ON employees
REFERENCING NEW AS n
FOR EACH ROW
BEGIN
    IF n.salary < 0 THEN
        SIGNAL SQLSTATE '70001' SET MESSAGE_TEXT = 'Salary cannot be negative';
    END IF;
END
@
