do $$
declare v_definition text;
begin
 v_definition:=pg_get_functiondef('public.create_self_order(text,text,text,text,jsonb,text)'::regprocedure);
 v_definition:=replace(v_definition,'case when p_payment_method=''cash'' then ''pending'' else ''submitted'' end','''pending''');
 execute v_definition;
end $$;
