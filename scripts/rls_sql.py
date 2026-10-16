"""Print supabase/tests/rls.test.sql as one self-reporting script for the Supabase SQL editor (or MCP).

Use when `supabase test db --linked` isn't available. Each assertion's TAP line is collected, and the
script ends by raising an error that carries the summary ("PGTAP 38/38 ok; failed: none"). That error
also rolls the whole transaction back, so no fixture rows are left in the database.

    python scripts/rls_sql.py > rls_run.sql
"""

import re
from pathlib import Path

sql = (Path(__file__).parents[1] / "supabase/tests/rls.test.sql").read_text(encoding="utf-8")
sql = re.sub(
    r"select plan\((\d+)\);",
    r"set local search_path = public, extensions;\nselect plan(\1);\n"
    r"create temp table r (line text);\ngrant all on r to public;",
    sql,
)
sql = re.sub(r"^select (is|ok|throws_ok|lives_ok|is_empty)\(", r"insert into r select \1(", sql, flags=re.M)
sql = sql.replace(
    "select * from finish();\nrollback;",
    """reset role;
do $$ declare s text; begin
  select format('PGTAP %s/%s ok; failed: %s', count(*) filter (where line like 'ok%'), count(*),
    coalesce(string_agg(line, ' || ') filter (where line not like 'ok%'), 'none')) into s from r;
  raise exception '%', s;
end $$;""",
)
print(sql)
