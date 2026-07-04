def parse_grammar(lines):
    """
    解析输入的文法产生式
    输入格式：每行一条产生式，形如 左部 -> 右部1 | 右部2 | ...
    符号间用空格分隔，空串用 # 表示
    """
    grammar = {}
    for line in lines:
        line = line.strip()
        if not line or '->' not in line:
            continue
        left_part, right_part = line.split('->', 1)
        non_terminal = left_part.strip()
        candidates = right_part.split('|')
        prod_list = []
        for cand in candidates:
            cand = cand.strip()
            if cand == '#':
                prod_list.append(['ε'])
            else:
                symbols = cand.split()
                symbols = ['ε' if s == '#' else s for s in symbols]
                prod_list.append(symbols)
        grammar[non_terminal] = prod_list
    return grammar


def compute_first(grammar):
    """计算所有文法符号的First集合"""
    first = {}
    non_terminals = set(grammar.keys())
    
    all_symbols = set(non_terminals)
    for productions in grammar.values():
        for prod in productions:
            for sym in prod:
                all_symbols.add(sym)
    terminals = all_symbols - non_terminals - {'ε'}
    
    for t in terminals:
        first[t] = {t}
    first['ε'] = {'ε'}
    for nt in non_terminals:
        first[nt] = set()
    
    updated = True
    while updated:
        updated = False
        for A in non_terminals:
            for prod in grammar[A]:
                all_have_epsilon = True
                for sym in prod:
                    for s in first[sym]:
                        if s != 'ε' and s not in first[A]:
                            first[A].add(s)
                            updated = True
                    if 'ε' not in first[sym]:
                        all_have_epsilon = False
                        break
                if all_have_epsilon:
                    if 'ε' not in first[A]:
                        first[A].add('ε')
                        updated = True
    return first, non_terminals, terminals


def first_of_string(symbols, first):
    """计算一个符号串的First集合"""
    result = set()
    all_epsilon = True
    for sym in symbols:
        for s in first[sym]:
            if s != 'ε':
                result.add(s)
        if 'ε' not in first[sym]:
            all_epsilon = False
            break
    if all_epsilon:
        result.add('ε')
    return result


def compute_follow(grammar, first, non_terminals, start_nt=None):
    """计算所有非终结符的Follow集合"""
    follow = {nt: set() for nt in non_terminals}
    
    if start_nt is None:
        start_nt = next(iter(grammar.keys()))
    follow[start_nt].add('$')
    
    updated = True
    while updated:
        updated = False
        for A in grammar:
            for prod in grammar[A]:
                for idx, B in enumerate(prod):
                    if B not in non_terminals:
                        continue
                    beta = prod[idx + 1:]
                    first_beta = first_of_string(beta, first)
                    
                    for s in first_beta:
                        if s != 'ε' and s not in follow[B]:
                            follow[B].add(s)
                            updated = True
                    
                    if len(beta) == 0 or 'ε' in first_beta:
                        for s in follow[A]:
                            if s not in follow[B]:
                                follow[B].add(s)
                                updated = True
    return follow


def construct_ll1_table(grammar, first, follow, non_terminals, terminals):
    """构造LL(1)分析表，返回分析表、列符号、是否存在冲突"""
    table_columns = sorted(terminals) + ['$']
    ll1_table = {nt: {t: [] for t in table_columns} for nt in non_terminals}
    has_conflict = False

    for A in non_terminals:
        for prod in grammar[A]:
            first_alpha = first_of_string(prod, first)
            prod_str = f"{A} → {' '.join(prod)}"

            for a in first_alpha:
                if a != 'ε':
                    ll1_table[A][a].append(prod_str)
                    if len(ll1_table[A][a]) > 1:
                        has_conflict = True

            if 'ε' in first_alpha:
                for b in follow[A]:
                    ll1_table[A][b].append(prod_str)
                    if len(ll1_table[A][b]) > 1:
                        has_conflict = True

    return ll1_table, table_columns, has_conflict


def ll1_analyze(ll1_table, start_symbol, input_symbols):
    """
    栈驱动的LL(1)语法分析过程
    逐行输出步骤、分析栈、剩余输入与分析动作
    遇到语法错误时输出错误信息并终止分析
    """
    stack = ['$', start_symbol]
    input_list = input_symbols + ['$']
    ptr = 0
    step = 0
    
    # 格式化输出表头
    print(f"{'步骤':<6} {'分析栈':<28} {'剩余输入':<28} {'动作'}")
    print('-' * 90)
    
    while True:
        step += 1
        top = stack[-1]
        current_input = input_list[ptr]
        stack_str = ' '.join(stack)
        input_str = ' '.join(input_list[ptr:])
        
        # 情况1：栈与输入同时到达结束符，分析成功
        if top == '$' and current_input == '$':
            print(f"{step:<6} {stack_str:<28} {input_str:<28} 分析成功，输入串合法")
            return True
        
        # 情况2：栈顶是终结符，执行匹配操作
        if top not in ll1_table:
            if top == current_input:
                action = f"匹配终结符 {top}"
                print(f"{step:<6} {stack_str:<28} {input_str:<28} {action}")
                stack.pop()
                ptr += 1
            else:
                action = f"语法错误：栈顶终结符「{top}」与输入符号「{current_input}」不匹配"
                print(f"{step:<6} {stack_str:<28} {input_str:<28} {action}")
                return False
        
        # 情况3：栈顶是非终结符，查分析表执行推导
        else:
            if current_input in ll1_table[top] and ll1_table[top][current_input]:
                prod = ll1_table[top][current_input][0]
                action = f"用产生式 {prod} 推导"
                print(f"{step:<6} {stack_str:<28} {input_str:<28} {action}")
                stack.pop()
                # 产生式右部逆序压栈，空串不压栈
                right_part = prod.split(' → ')[1].split()
                if right_part != ['ε']:
                    for sym in reversed(right_part):
                        stack.append(sym)
            else:
                action = f"语法错误：非终结符「{top}」遇到输入「{current_input}」，无对应产生式"
                print(f"{step:<6} {stack_str:<28} {input_str:<28} {action}")
                return False


def main():
    print("=== LL(1) 语法分析程序 ===")
    print("输入规则：")
    print("1. 每行一条产生式，格式：非终结符 -> 候选式1 | 候选式2 ...")
    print("2. 符号之间用空格分隔，空串用 # 表示")
    print("3. 默认第一个产生式左部为文法开始符号")
    print("4. 输入完成后按两次回车结束\n")
    print("请输入文法产生式：")

    # 读取文法
    input_lines = []
    while True:
        line = input()
        if not line.strip():
            break
        input_lines.append(line)
    
    if not input_lines:
        print("未输入任何产生式！")
        return

    # 计算基础集合与分析表
    grammar = parse_grammar(input_lines)
    first_set, non_terminals, terminals = compute_first(grammar)
    follow_set = compute_follow(grammar, first_set, non_terminals)
    ll1_table, _, has_conflict = construct_ll1_table(
        grammar, first_set, follow_set, non_terminals, terminals
    )

    if has_conflict:
        print("\n⚠️  警告：该文法存在分析表冲突，不是LL(1)文法，无法保证分析正确性")
    else:
        print("\n✅ 文法校验通过，为LL(1)文法")

    # 读取待分析符号串
    print("\n请输入待分析的符号串（符号之间用空格分隔）：")
    input_str = input().strip()
    input_symbols = input_str.split()
    
    if not input_symbols:
        print("未输入任何符号！")
        return

    # 执行LL(1)分析
    start_symbol = next(iter(grammar.keys()))
    print("\n" + "=" * 90)
    print("LL(1) 语法分析过程：")
    print("-" * 90)
    ll1_analyze(ll1_table, start_symbol, input_symbols)
    print("=" * 90)


if __name__ == "__main__":
    main()