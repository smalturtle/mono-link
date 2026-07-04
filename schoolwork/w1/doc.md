


项目注解大全与解析

# 一、本项目中用到的注解

## 1. @SpringBootApplication
- **功能简述**：Spring Boot项目入口注解，组合了@Configuration、@EnableAutoConfiguration、@ComponentScan，开启自动配置和组件扫描。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类TliasWebManagementApplication.java和SpringbootWebConfigApplication.java上，标识这是Spring Boot应用入口，启动项目。
  - **源码逻辑简述**：该注解组合了三个核心注解，让Spring Boot自动扫描当前包及子包下的所有组件，自动配置依赖，无需手动配置XML。本项目中它负责启动整个Web应用，初始化Spring容器。
- **代码示例**：
```java
@SpringBootApplication
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 2. @ServletComponentScan
- **功能简述**：开启Servlet组件扫描，让Spring扫描并注册Filter、Servlet、Listener等原生Servlet组件。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类上，配合`@WebFilter`注解让TokenFilter过滤器注册到Spring容器中，完成JWT令牌校验。
  - **源码逻辑简述**：Spring启动时扫描带`@WebFilter`注解的类，注册为过滤器，TokenFilter用于拦截所有请求，在处理业务前校验JWT令牌，未携带令牌或令牌非法直接返回401。
- **代码示例**：
```java
@SpringBootApplication
@ServletComponentScan
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 3. @Target
- **功能简述**：元注解，指定自定义注解可以应用在哪些代码元素上（方法、类、字段等）。
- **本项目应用举例**：
  - **应用场景**：用在自定义注解@Log和@EnableHeaderConfig上，指定注解的使用范围。
  - **源码逻辑简述**：@Log注解指定ElementType.METHOD，表示该注解只能加在方法上，配合AOP做操作日志记录，避免误用在类或字段上。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 4. @Retention
- **功能简述**：元注解，指定自定义注解的保留策略，即注解在哪个阶段仍然保留（源码、class文件、运行时）。
- **本项目应用举例**：
  - **应用场景**：配合@Target一起用在自定义注解上，指定@Log注解在运行时保留，这样AOP切面才能通过反射读取到该注解。
  - **源码逻辑简述**：RetentionPolicy.RUNTIME表示注解一直保留到运行时，AOP切面能通过反射识别方法上是否标记了该注解，从而进行操作日志的记录，如果不是RUNTIME，运行时就获取不到注解信息了。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 5. @Log (自定义)
- **功能简述**：本项目自定义注解，用于标记需要记录操作日志的方法。
- **本项目应用举例**：
  - **应用场景**：用在DeptController、EmpController、StudentController等Controller层增删改方法上，标识这些操作需要记录操作人、操作时间、执行耗时等日志信息。
  - **源码逻辑简述**：该注解本身不包含逻辑，只是一个标记，OperationLogAspect环绕切面会拦截所有带@Log的方法，在方法执行前后记录操作信息并插入数据库，用户查看操作历史时可以追溯。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 6. @Slf4j
- **功能简述**：Lombok提供的注解，自动在类中注入org.slf4j.Logger日志对象，简化日志开发。
- **本项目应用举例**：
  - **应用场景**：几乎所有类都使用了@Slf4j，包括Controller、Service、Aspect、ExceptionHandler等，用于输出日志信息，调试和排错。
  - **源码逻辑简述**：编译阶段Lombok自动生成`private static final Logger log = LoggerFactory.getLogger(当前类.class);`代码，开发者直接使用`log.info()`、`log.error()`输出日志，不需要手动写Logger声明，减少模板代码。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    public Result list() {
        log.info("查询全部部门数据");
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 7. @Aspect
- **功能简述**：Spring AOP注解，标识一个类是切面类，包含切面逻辑（通知）。
- **本项目应用举例**：
  - **应用场景**：用在OperationLogAspect上，让Spring识别这是一个切面，用于操作日志的AOP处理。
  - **源码逻辑简述**：配合@Component注册到Spring容器，@Around定义环绕通知，拦截所有带@Log注解的方法，在方法执行前后记录操作日志并保存到数据库。
- **代码示例**：
```java
@Slf4j
@Aspect
@Component
public class OperationLogAspect {
    @Around("@annotation(org.example.anno.Log)")
    public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long costTime = System.currentTimeMillis() - startTime;
        operateLogMapper.insert(olog);
        return result;
    }
}
```

## 8. @Around
- **功能简述**：Spring AOP的环绕通知注解，指定切面方法在目标方法执行前后都执行，可以控制目标方法是否执行。
- **本项目应用举例**：
  - **应用场景**：在OperationLogAspect中使用，匹配所有带@Log注解的方法，实现操作日志记录。
  - **源码逻辑简述**：@Around注解的切点表达式匹配`@annotation(org.example.anno.Log)`，即只拦截带@Log的方法。环绕通知先记录开始时间，调用目标方法，再计算耗时，封装操作日志对象，保存到数据库。
- **代码示例**：
```java
@Around("@annotation(org.example.anno.Log)")
public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
    long startTime = System.currentTimeMillis();
    Object result = joinPoint.proceed();
    return result;
}
```

## 9. @Component
- **功能简述**：Spring通用组件注解，标识一个类为Spring管理的Bean，会被自动扫描并注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：用在多个类上，如OperationLogAspect、TokenInterceptor、AliyunOSSOperator、TokenParser等，让这些类被Spring容器管理，方便依赖注入。
  - **源码逻辑简述**：Spring组件扫描时会把带@Component的类实例化，存入IOC容器，其它类可以通过@Autowired注入使用。例如TokenInterceptor需要被WebConfig注册到拦截器链，必须先被Spring管理。
- **代码示例**：
```java
@Slf4j
@Component
public class TokenInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, ...) {
        return true;
    }
}
```

## 10. @Autowired
- **功能简述**：Spring依赖注入注解，自动从IOC容器中匹配并注入依赖对象，默认按类型匹配。
- **本项目应用举例**：
  - **应用场景**：几乎所有需要依赖注入的地方都在用，Controller注入Service，Service注入Mapper，工具类注入配置Bean等。例如DeptController注入DeptService，调用业务逻辑。
  - **源码逻辑简述**：Spring容器启动后，解析@Autowired注解，根据字段类型从容器中找到对应的Bean，反射注入到字段中，解耦了组件之间的依赖关系，不需要手动new对象。
- **代码示例**：
```java
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 11. @Configuration
- **功能简述**：Spring配置类注解，标识该类是配置类，用于定义Bean配置，替代XML配置文件。
- **本项目应用举例**：
  - **应用场景**：用在WebConfig和HeaderConfig上，注册拦截器配置或手动定义Bean。
  - **源码逻辑简述**：@Configuration类会被Spring特殊处理，其中定义的@Bean方法会被调用，返回值注册为Bean。本项目WebConfig实现WebMvcConfigurer接口注册拦截器，对请求进行拦截处理。
- **代码示例**：
```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Autowired
    private TokenInterceptor tokenInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册拦截器...
    }
}
```

## 12. @RestController
- **功能简述**：组合了@Controller和@ResponseBody，标识这是REST控制器，每个方法返回值直接写入HTTP响应体，默认返回JSON格式。
- **本项目应用举例**：
  - **应用场景**：所有Controller层类都用@RestController，如DeptController、EmpController等，前后端分离项目，接口返回JSON数据。
  - **源码逻辑简述**：方法返回的Result对象会被Spring消息转换器自动转换为JSON格式返回给前端，不需要每个方法加@ResponseBody。本项目所有接口都遵循这个约定，前端AJAX请求拿到JSON后处理。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;

    @GetMapping("/depts")
    public Result list() {
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 13. @RequestMapping
- **功能简述**：请求映射注解，指定请求路径和请求方法，将HTTP请求映射到对应的Controller方法。
- **本项目应用举例**：
  - **应用场景**：用在Controller类上提取公共路径前缀，如EmpController类上加`@RequestMapping("/emps")`，所有方法路径都以/emps开头。
  - **源码逻辑简述**：统一管理同模块接口路径，避免每个方法重复写相同前缀。本项目按业务模块划分路径，方便管理和理解接口归属。
- **代码示例**：
```java
@Slf4j
@RequestMapping("/emps")
@RestController
public class EmpController {
    @Autowired
    private EmpService empService;
}
```

## 14. @GetMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.GET，处理GET请求。
- **本项目应用举例**：
  - **应用场景**：用于查询接口，如查询部门列表、查询员工信息、分页查询等GET请求，HTTP GET用于获取数据。
  - **源码逻辑简述**：Spring框架将GET请求映射到对应方法执行，返回查询结果封装成JSON。本项目遵循REST风格，GET用于查询操作。
- **代码示例**：
```java
@GetMapping("/depts")
public Result list() {
    List<Dept> deptlist = deptService.findAll();
    return Result.success(deptlist);
}
```

## 15. @PostMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.POST，处理POST请求，一般用于新增数据。
- **本项目应用举例**：
  - **应用场景**：用于新增部门、新增员工、新增学员、文件上传、登录等POST请求。
  - **源码逻辑简述**：前端通过POST提交JSON数据给后端，后端接收并保存到数据库。本项目遵循REST风格，POST用于新增操作。
- **代码示例**：
```java
@Log
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 16. @DeleteMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.DELETE，处理DELETE请求，一般用于删除数据。
- **本项目应用举例**：
  - **应用场景**：删除部门、删除员工、删除学员等操作，遵循RESTful风格。
  - **源码逻辑简述**：前端通过DELETE请求传递要删除的ID，后端调用Service删除对应数据。本项目遵循REST风格，DELETE用于删除操作。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 17. @PutMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.PUT，处理PUT请求，一般用于更新数据。
- **本项目应用举例**：
  - **应用场景**：修改部门、修改员工、修改学员信息等更新操作。
  - **源码逻辑简述**：前端通过PUT提交修改后的完整对象，后端更新数据库对应记录。本项目遵循REST风格，PUT用于更新操作。
- **代码示例**：
```java
@Log
@PutMapping("/depts")
public Result update(@RequestBody Dept dept) {
    log.info("修改部门数据: {}",dept);
    deptService.update(dept);
    return Result.success();
}
```

## 18. @RequestParam
- **功能简述**：绑定请求参数到方法形参，指定请求参数必须携带，也可以设置默认值。
- **本项目应用举例**：
  - **应用场景**：分页查询参数，指定page和pageSize的默认值，前端不传时使用默认值，避免空指针。
  - **源码逻辑简述**：当请求参数名和方法形参名不同时，可以指定名称；required属性控制是否必须携带，defaultValue设置默认值。本项目分页查询默认第一页，每页10条数据。
- **代码示例**：
```java
@GetMapping
public Result page(String name,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate begin,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate end,
                   @RequestParam(defaultValue = "1") Integer page,
                   @RequestParam(defaultValue = "10") Integer pageSize){
    PageResult pageResult = clazzService.page(name,begin,end,page,pageSize);
    return Result.success(pageResult);
}
```

## 19. @PathVariable
- **功能简述**：绑定URL路径中的占位符参数到方法形参，用于RESTful风格的路径参数。
- **本项目应用举例**：
  - **应用场景**：根据ID查询详情，ID放在URL路径中，如`/depts/{id}`，@PathVariable获取路径中的id值。
  - **源码逻辑简述**：Spring框架会把URL中匹配占位符的值取出，赋值给方法参数。REST风格中将资源ID放在路径中比查询参数更清晰。
- **代码示例**：
```java
@GetMapping("/depts/{id}")
public Result getInfo(@PathVariable Integer id) {
    log.info("根据id查询部门数据: {}",id);
    Dept dept = deptService.getById(id);
    return Result.success(dept);
}
```

## 20. @RequestBody
- **功能简述**：绑定请求体中的JSON数据到方法参数对象，Spring自动将JSON反序列化为Java对象。
- **本项目应用举例**：
  - **应用场景**：新增、修改操作时，前端将整个对象以JSON格式放在请求体中发送给后端，后端用@RequestBody接收并封装为Java对象。
  - **源码逻辑简述**：通过HttpMessageConverter把请求体中的JSON字符串转换为指定类型的Java对象。本项目前后端分离，新增修改接口都用这个方式传参。
- **代码示例**：
```java
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 21. @DateTimeFormat
- **功能简述**：指定日期时间参数的格式化 pattern，将字符串按照指定格式解析为日期类型。
- **本项目应用举例**：
  - **应用场景**：分页查询时，前端传入字符串格式的开始日期和结束日期，后端通过@DateTimeFormat按照pattern="yyyy-MM-dd"解析为LocalDate对象。
  - **源码逻辑简述**：Spring MVC在绑定请求参数时，根据pattern格式解析字符串到日期类型，如果格式不匹配会报错。本项目在查询参数EmpQueryParam和Controller方法参数上都使用了。
- **代码示例**：
```java
@Data
public class EmpQueryParam {
    private Integer page = 1;
    private Integer pageSize = 5;
    private String name;
    private Integer gender;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate begin;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate end;
}
```

## 22. @WebFilter
- **功能简述**：原生Servlet注解，声明一个过滤器，指定过滤的URL路径。
- **本项目应用举例**：
  - **应用场景**：用在TokenFilter上，`urlPatterns = "/*"`表示拦截所有请求，在请求到达Servlet之前校验JWT令牌。
  - **源码逻辑简述**：配合@ServletComponentScan，Spring启动时会将过滤器注册到Servlet容器，对所有请求进行拦截处理。TokenFilter从中获取请求头中的token，校验失败直接返回401。
- **代码示例**：
```java
@Slf4j
@WebFilter(urlPatterns = "/*")
public class TokenFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        // 校验JWT令牌...
    }
}
```

## 23. @RestControllerAdvice
- **功能简述**：组合了@ControllerAdvice和@ResponseBody，用于全局异常处理，捕获所有Controller抛出的异常，统一处理返回JSON。
- **本项目应用举例**：
  - **应用场景**：用在GlobalExceptionHandler上，统一处理所有Controller抛出的异常，返回友好的错误提示。
  - **源码逻辑简述**：Spring捕获Controller抛出的异常后，会交给@RestControllerAdvice类中带@ExceptionHandler的方法处理，本项目对不同异常分类处理，统一封装为Result错误格式返回前端。
- **代码示例**：
```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler
    public Result handleException(Exception e){
        log.error("程序出错了 ",e);
        return Result.error("程序异常");
    }
}
```

## 24. @ExceptionHandler
- **功能简述**：指定处理哪种类型的异常，方法会处理该类型及其子类异常。
- **本项目应用举例**：
  - **应用场景**：在GlobalExceptionHandler中使用，分别处理Exception、DuplicateKeyException、BusinessException，不同异常返回不同错误提示。
  - **源码逻辑简述**：当Controller抛出指定类型的异常时，对应的@ExceptionHandler方法会被调用，本项目中唯一键冲突异常会提取出重复值信息返回，业务异常直接返回错误消息，其它异常返回通用"程序异常"。
- **代码示例**：
```java
@ExceptionHandler(BusinessException.class)
public Result handleBusinessException(BusinessException e){
    log.error("服务器异常: ", e);
    return Result.error(e.getMessage());
}
```

## 25. @Service
- **功能简述**：Spring业务逻辑层组件注解，标识这是Service层Bean，会被组件扫描注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：所有Service实现类都用@Service，如DeptServiceImpl、EmpServiceImpl等，Controller注入Service调用业务逻辑。
  - **源码逻辑简述**：本质和@Component一样，语义更清晰，标识这是业务逻辑层组件，分工更明确。Service层调用Mapper层完成业务处理，事务管理也加在Service层。
- **代码示例**：
```java
@Service
public class DeptServiceImpl implements DeptService {
    @Autowired
    private DeptMapper deptMapper;
}
```

## 26. @Transactional
- **功能简述**：Spring声明式事务注解，开启事务管理，指定方法执行出现异常时自动回滚事务。
- **本项目应用举例**：
  - **应用场景**：用在需要事务保护的Service方法上，如新增员工同时插入员工表和工作经历表，删除员工同时删除两张表，必须保证原子性，要么都成功要么都失败。
  - **源码逻辑简述**：方法进入时Spring开启事务，方法执行完毕如果抛出异常（指定rollbackFor范围内）自动回滚，没有异常提交事务。本项目设置`rollbackFor = Exception.class`表示所有异常都回滚，包括非运行时异常。
- **代码示例**：
```java
@Transactional(rollbackFor = {Exception.class})
@Override
public void save(Emp emp){
    emp.setCreateTime(LocalDateTime.now());
    emp.setUpdateTime(LocalDateTime.now());
    empMapper.insert(emp);
    List<EmpExpr> exprList = emp.getExprList();
    if(!CollectionUtils.isEmpty(exprList)){
        exprList.forEach(expr -> expr.setEmpId(emp.getId()));
        empExprMapper.insertBatch(exprList);
    }
}
```

## 27. Propagation (事务传播机制)
- **功能简述**：配合@Transactional使用，指定事务传播行为，即多个带事务方法互相调用时事务如何传播。
- **本项目应用举例**：
  - **应用场景**：在EmpLogServiceImpl.insertLog方法上使用`propagation = Propagation.REQUIRES_NEW`，表示无论调用方是否有事务，该方法都必须开启一个新事务，新事务独立于原有事务。
  - **源码逻辑简述**：insertLog不管外层事务是否成功，日志都要记录成功，不能因为外层事务回滚导致日志也回滚不记录。REQUIRES_NEW挂起原有事务，开启新事务执行，执行完恢复原有事务。
- **代码示例**：
```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
@Override
public void insertLog(EmpLog empLog) {
    empLogMapper.insert(empLog);
}
```

## 28. @Mapper
- **功能简述**：MyBatis注解，标识这是MyBatis的Mapper接口，MyBatis自动生成该接口的代理实现类，注册到Spring容器。
- **本项目应用举例**：
  - **应用场景**：所有MyBatis Mapper接口都加@Mapper，如DeptMapper、EmpMapper，Service注入Mapper调用数据库操作。
  - **源码逻辑简述**：MyBatis启动扫描所有@Mapper接口，动态生成代理对象，处理SQL执行和结果映射，把代理对象交给Spring管理，Service就能直接注入使用。
- **代码示例**：
```java
@Mapper
public interface DeptMapper {
    @Select("select id, name, create_time, update_time from dept order by update_time desc;")
    List<Dept> findAll();
}
```

## 29. @Select
- **功能简述**：MyBatis注解，标注查询SQL，直接在注解上写SELECT语句，不需要XML映射文件。
- **本项目应用举例**：
  - **应用场景**：简单查询直接使用@Select写SQL，复杂查询使用XML，本项目DeptMapper简单查询都用注解方式。
  - **源码逻辑简述**：MyBatis执行方法时提取注解中的SQL，执行查询，自动将结果映射到返回值类型。对于单表简单查询，注解比XML更简洁。
- **代码示例**：
```java
@Select("select id, name, create_time, update_time from dept where id = #{id}")
Dept getById(Integer id);
```

## 30. @Insert
- **功能简述**：MyBatis注解，标注插入SQL，直接在注解上写INSERT语句。
- **本项目应用举例**：
  - **应用场景**：简单插入操作使用@Insert写SQL，如新增部门、插入操作日志等。
  - **源码逻辑简述**：MyBatis解析参数，执行INSERT语句，返回影响行数。配合@Options可以配置主键回写。
- **代码示例**：
```java
@Insert("insert into dept(name, create_time, update_time) values(#{name}, #{createTime}, #{updateTime});")
void insert(Dept dept);
```

## 31. @Delete
- **功能简述**：MyBatis注解，标注删除SQL，直接在注解上写DELETE语句。
- **本项目应用举例**：
  - **应用场景**：简单删除操作使用@Delete写SQL。
  - **源码逻辑简述**：MyBatis执行DELETE语句，返回影响行数。
- **代码示例**：
```java
@Delete("delete from dept where id = #{id};")
void deleteById(Integer id);
```

## 32. @Update (MyBatis)
- **功能简述**：MyBatis注解，标注更新SQL，直接在注解上写UPDATE语句。
- **本项目应用举例**：
  - **应用场景**：简单更新操作使用@Update写SQL。
  - **源码逻辑简述**：MyBatis执行UPDATE语句，返回影响行数。
- **代码示例**：
```java
@Update("update dept set name = #{name}, update_time = #{updateTime} where id = #{id}")
void update(Dept dept);
```

## 33. @Options
- **功能简述**：MyBatis注解，配置映射选项，支持配置主键生成、超时等。
- **本项目应用举例**：
  - **应用场景**：在EmpMapper.insert上使用`useGeneratedKeys = true, keyProperty = "id"`，配置主键回写，插入数据后自动把数据库生成的自增主键回写到Emp对象的id属性。
  - **源码逻辑简述**：插入成功后MyBatis从数据库获取生成的自增主键，赋值给keyProperty指定的属性。因为插入员工后需要用到员工id插入工作经历列表，所以必须回写主键。
- **代码示例**：
```java
@Options(useGeneratedKeys = true, keyProperty = "id")
@Insert("insert into emp(username, name, gender, phone, job, salary, image, entry_date, dept_id, create_time, update_time)" +
        "values (#{username},#{name},#{gender},#{phone},#{job},#{salary},#{image},#{entryDate},#{deptId},#{createTime},#{updateTime})")
void insert(Emp emp);
```

## 34. @MapKey
- **功能简述**：MyBatis注解，指定将查询结果的哪一列作为Map的key，封装为Map返回。
- **本项目应用举例**：
  - **应用场景**：在统计查询方法上使用，将统计结果按指定列分组封装。
  - **源码逻辑简述**：MyBatis查询结果转换后，以@MapKey指定字段的值作为key封装成Map，方便后续处理。本项目统计职位人数和性别人数都使用了。
- **代码示例**：
```java
@MapKey("pos")
List<Map<String,Object>> countEmpJobData();

@MapKey("name")
List<Map<String, Object>> countEmpGenderData();
```

## 35. @Data
- **功能简述**：Lombok注解，自动生成getter、setter、toString、equals、hashCode方法。
- **本项目应用举例**：
  - **应用场景**：所有POJO类、实体类、配置属性类都使用@Data，如Result、Emp、AliyunOSSProperties等，消除样板代码。
  - **源码逻辑简述**：编译阶段Lombok自动为类生成所有字段的getter、setter等方法，开发者不需要手动写，代码更简洁，修改字段属性不需要修改这些方法。
- **代码示例**：
```java
@Data
public class Result {
    private Integer code;
    private String msg;
    private Object data;
}
```

## 36. @NoArgsConstructor
- **功能简述**：Lombok注解，自动生成无参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要无参构造器的实体类上使用，如PageResult、Student、Clazz，框架反射创建对象需要无参构造器。
  - **源码逻辑简述**：当类中已经有全参构造器时，Java不会默认生成无参构造器，所以需要显式加@NoArgsConstructor生成，配合@AllArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 37. @AllArgsConstructor
- **功能简述**：Lombok注解，自动生成全参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要全参构造的实体类上使用，如PageResult，创建对象时可以一次性给所有属性赋值。
  - **源码逻辑简述**：Lombok编译生成包含所有字段的构造器，方便通过构造器注入属性值，配合@NoArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 38. @Value (Spring)
- **功能简述**：Spring注解，从配置文件中注入单个配置属性值到字段。
- **本项目应用举例**：
  - **应用场景**：AliyunOSSOperator注释代码中使用@Value注入OSS配置，注释掉的代码演示了@Value用法，实际项目改用@ConfigurationProperties。
  - **源码逻辑简述**：Spring启动时解析${}占位符，从application.yml中取出对应配置赋值给字段。适合单个少量配置属性注入。
- **代码示例**：
```java
@Value("${aliyun.oss.endpoint}")
private String endpoint;
```

## 39. @ConfigurationProperties
- **功能简述**：Spring Boot注解，批量注入配置文件中前缀匹配的属性到JavaBean，类型安全的配置绑定。
- **本项目应用举例**：
  - **应用场景**：在AliyunOSSProperties上使用，prefix = "aliyun.oss"，将配置文件中所有以aliyun.oss开头的配置绑定到对应的字段。
  - **源码逻辑简述**：Spring Boot自动配置根据前缀匹配，将配置文件中的值按照字段名映射注入，比多个@Value更整洁，支持批量绑定，IDE也能自动提示。
- **代码示例**：
```java
@Data
@Component
@ConfigurationProperties(prefix = "aliyun.oss")
public class AliyunOSSProperties {
    private String endpoint;
    private String bucketName;
    private String region;
}
```

## 40. @Import
- **功能简述**：Spring注解，手动导入指定的类到Spring容器，一般用在注解上导入配置类。
- **本项目应用举例**：
  - **应用场景**：在自定义注解@EnableHeaderConfig上使用@Import导入MyImportSelector，实现按需导入配置。
  - **源码逻辑简述**：@Import导入MyImportSelector，MyImportSelector实现ImportSelector接口返回需要导入的配置类全限定名，Spring注册这些配置类到容器，实现模块化装配。这个例子演示了如何开发一个需要开启注解才能使用的功能模块。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

## 41. @Bean
- **功能简述**：Spring注解，用在@Configuration类中，声明方法返回值是一个Bean，交给Spring容器管理。
- **本项目应用举例**：
  - **应用场景**：SpringbootWebConfigApplication中使用@Bean方法注册AliyunOSSOperator，接收参数注入AliyunOSSProperties。也在HeaderConfig中注册HeaderParser和HeaderGenerator。
  - **源码逻辑简述**：调用方法获取返回值，将返回值注册为Bean存入IOC容器，方法参数自动从容器注入依赖。适合把第三方类实例化为Bean交给Spring管理，本项目演示了这种用法。
- **代码示例**：
```java
@Bean
public AliyunOSSOperator aliyunOSSOperator(AliyunOSSProperties aliyunOSSProperties){
    return new AliyunOSSOperator(aliyunOSSProperties);
}
```

## 42. @Scope
- **功能简述**：Spring注解，指定Bean的作用域（单例、多例等）。
- **本项目应用举例**：
  - **应用场景**：在DeptController中使用`@Scope("prototype")`，演示多例模式，每次请求创建新的Controller实例。
  - **源码逻辑简述**：默认是singleton单例，全局只有一个实例；prototype多例，每次获取Bean都创建新实例。这个示例演示了作用域的用法，实际项目Controller一般都是单例。
- **代码示例**：
```java
@Scope("prototype")
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 43. @SpringBootTest
- **功能简述**：Spring Boot测试注解，标识这是一个Spring Boot单元测试类，会启动Spring容器。
- **本项目应用举例**：
  - **应用场景**：用在测试类上，整合Spring进行单元测试，可以注入容器中的Bean进行测试。
  - **源码逻辑简述**：JUnit测试启动时加载Spring Boot应用上下文，创建Spring容器，测试方法可以使用@Autowired注入Bean测试功能。本项目测试类使用了该注解。
- **代码示例**：
```java
@SpringBootTest
class SpringbootWebTests {
    @Autowired
    private DeptService deptService;
}
```

## 44. @Test
- **功能简述**：JUnit测试注解，标识这是一个测试方法，可以被JUnit运行器执行。
- **本项目应用举例**：
  - **应用场景**：测试类中的每个测试方法都加@Test，单元测试单独功能。
  - **源码逻辑简述**：JUnit执行测试时运行所有带@Test的方法，断言结果，输出测试报告。本项目演示了单元测试的写法。
- **代码示例**：
```java
@Test
void contextLoads() {
}
```

## 45. @EnableHeaderConfig (自定义)
- **功能简述**：本项目自定义开启注解，用于开启Header相关功能配置，演示基于注解的模块装配。
- **本项目应用举例**：
  - **应用场景**：在itheima-utils模块中定义，用户只需要在启动类上加上这个注解就能自动导入Header相关配置，不需要手动配置多个Bean。这是Spring Boot自动配置的雏形。
  - **源码逻辑简述**：该注解用@Import导入MyImportSelector，MyImportSelector返回HeaderConfig的全类名，Spring注册HeaderConfig，HeaderConfig定义了HeaderParser和HeaderGenerator两个Bean，实现一键开启功能。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

---

# 二、本项目中未用到但常用的注解

## 1. @Controller
- **功能简述**：Spring控制器注解，标识这是MVC模式的Controller，配合视图解析器返回视图页面，如果要返回JSON需要方法或类上加@ResponseBody。前后端不分离项目常用，本项目前后端分离用@RestController替代。

## 2. @ResponseBody
- **功能简述**：将方法返回值直接写入HTTP响应体，一般返回JSON格式数据。在@RestController出现之前，通常@Controller搭配@ResponseBody使用。

## 3. @Qualifier
- **功能简述**：配合@Autowired使用，当同一个接口有多个实现类时，通过@Qualifier指定按名称注入，解决同类型多个Bean的歧义问题。@Autowired默认按类型匹配，找不到唯一匹配时需要@Qualifier指定名称。

## 4. @Resource
- **功能简述**：Java JSR-250规范提供的依赖注入注解，默认按名称匹配，找不到再按类型匹配，是Spring支持的另一种依赖注入方式，和@Autowired功能类似但匹配规则不同。

## 5. @ComponentScan
- **功能简述**：指定Spring组件扫描的包路径，@SpringBootApplication已经包含了这个注解，默认扫描启动类当前包及其子包。需要自定义扫描范围时使用。

## 6. @ConfigurationPropertiesScan
- **功能简述**：Spring Boot注解，指定扫描哪些包下的@ConfigurationProperties配置类，自动注册到容器。开启对@ConfigurationProperties的扫描支持。

## 7. @EnableAutoConfiguration
- **功能简述**：Spring Boot自动配置注解，告诉Spring Boot根据类路径下的依赖自动配置项目，比如引入了spring-boot-starter-web就自动配置Tomcat和Spring MVC。@SpringBootApplication已经包含了这个注解。

## 8. @Conditional
- **功能简述**：Spring条件注解，满足条件才注册Bean到容器，Spring Boot自动配置大量使用这个注解，根据条件决定是否配置。派生注解有@ConditionalOnClass、@ConditionalOnProperty、@ConditionalOnMissingBean等。

## 9. @Lazy
- **功能简述**：开启懒加载，Bean不在容器启动时创建，第一次使用时才创建，加快项目启动速度，节省内存。适合不常用的Bean。本项目代码注释中有示例，但实际未启用。

## 10. @Primary
- **功能简述**：当同一个接口有多个实现Bean时，指定哪个是主要候选者，自动注入时优先选择这个Bean，解决歧义问题，比@Qualifier更简洁。

## 11. @SessionAttributes
- **功能简述**：将模型中的属性存储到Session域，用于在多个请求之间共享数据，传统MVC开发中使用，前后端分离项目很少用。

## 12. @CookieValue
- **功能简述**：绑定Cookie中的值到方法参数，获取指定Cookie的值，需要读取Cookie信息时使用。

## 13. @RequestHeader
- **功能简述**：绑定请求头到方法参数，获取指定请求头的值，需要读取请求头信息时使用，比如获取User-Agent、Authorization等。

## 14. @CrossOrigin
- **功能简述**：开启跨域支持，标注在Controller或方法上，允许跨域请求。Spring MVC会自动处理跨域预检请求，设置正确的CORS响应头。项目一般通过全局CORS配置或网关处理跨域，局部也可以用这个注解。

## 15. @Repository
- **功能简述**：Spring持久层组件注解，作用和@Component类似，语义更清晰，标识这是DAO/Mapper层组件。现在MyBatis项目一般用@Mapper，比@Repository更方便。

## 16. @Param
- **功能简述**：MyBatis注解，为Mapper接口方法参数指定名称，映射到SQL中的#{name}占位符，多个参数时必须加@Param指定名称。如果接口只有一个简单参数可以省略。

## 17. @Results / @Result
- **功能简述**：MyBatis注解，配置自定义结果映射，映射查询结果列到Java对象属性，解决列名和属性名不匹配的问题，复杂结果映射可以使用这个注解，一般简单查询不需要。

## 18. @OneToMany / @ManyToOne / @OneToOne
- **功能简述**：JPA/Hibernate关联注解，配置实体之间的关联关系，一对多、多对一、一对一关联。MyBatis项目一般不需要这些注解，JPA项目大量使用。

## 19. @Entity
- **功能简述**：JPA注解，标识这是一个实体类，对应数据库表，JPA项目每个实体类需要加这个注解。

## 20. @Id / @GeneratedValue
- **功能简述**：JPA注解，@Id标识主键字段，@GeneratedValue指定主键生成策略（自增、序列、UUID等）。

## 21. @Override
- **功能简述**：Java元注解，标识方法重写父接口/父类的方法，编译器会检查是否正确重写，这是一个标记注解，不影响运行，只是帮助编译器检查，好的编码习惯都会加上。

## 22. @Deprecated
- **功能简述**：Java元注解，标识方法、类、字段已过时，不推荐使用，编译器会发出警告，一般有更好的替代方案。

## 23. @SuppressWarnings
- **功能简述**：Java元注解，抑制编译器指定类型的警告，告诉编译器这里不需要警告，代码是故意这么写的。

## 24. @NonNull / @Nullable
- **功能简述**：JetBrains/Java注解，标记参数或返回值是否可以为null，IDE会给出空指针警告，静态代码检查帮助提前发现空指针问题。

## 25. @Valid / @Validated
- **功能简述**：Spring参数校验注解，开启JSR-303数据校验，对方法参数进行校验，配合@NotNull、@Min、@Max等约束注解使用，不满足约束时抛出BindException。接口入参校验常用。

## 26. @NotNull / @NotEmpty / @NotBlank
- **功能简述**：Bean Validation约束注解，校验参数不为null、不为空字符串、不为空白，数据校验常用，配合@Valid使用。

## 27. @Async
- **功能简述**：Spring异步方法注解，标注方法会在异步线程中执行，不阻塞主线程，需要在配置类上加@EnableAsync开启异步支持。适合发邮件、记录日志等不需要同步等待的操作。

## 28. @Scheduled
- **功能简述**：Spring定时任务注解，指定方法定时执行，支持cron表达式、固定延迟、固定频率，需要在配置类上加@EnableScheduling开启定时任务。项目定时任务使用。

## 29. @ControllerAdvice
- **功能简述**：Spring全局增强注解，可以用于全局异常处理、全局数据绑定、全局数据预处理，配合@ExceptionHandler做全局异常处理，本项目用@RestControllerAdvice（组合了@ControllerAdvice+@ResponseBody）。

## 30. @PostConstruct
- **功能简述**：Java注解，标记方法在Bean构造完成、依赖注入完成后执行，做一些初始化工作，在Bean生命周期中执行一次。

## 31. @PreDestroy
- **功能简述**：Java注解，标记方法在Bean销毁前执行，做一些清理工作，释放资源。

## 32. @Cacheable / @CacheEvict / @CachePut
- **功能简述**：Spring缓存注解，@Cacheable将方法返回值缓存，下次相同参数直接从缓存取；@CacheEvict清理缓存；@CachePut更新缓存。需要开启缓存后使用，提升查询性能减轻数据库压力。

## 33. @FeignClient
- **功能简述**：Spring Cloud OpenFeign注解，声明这是一个HTTP客户端接口，OpenFeign自动生成实现，调用其他微服务接口。微服务项目常用。

## 34. @PatchMapping
- **功能简述**：快捷注解，对应PATCH请求方法，RESTful风格常用于部分更新，本项目使用PUT做全量更新，没有用到PATCH。

## 35. @Order
- **功能简述**：Spring注解，指定Bean的排序，值越小优先级越高，多个拦截器、过滤器排序时使用，控制执行顺序。

## 36. @PropertySource
- **功能简述**：Spring注解，指定加载额外的properties配置文件，引入外部配置文件。Spring Boot自动加载application.properties/yml，一般不需要，自定义配置文件时使用。

## 37. @ImportResource
- **功能简述**：Spring注解，导入Spring XML配置文件，兼容老项目的XML配置，现在全注解开发很少用。

## 38. @TransactionalEventListener
- **功能简述**：Spring事件监听注解，监听事务提交后事件，实现业务解耦，事务提交后再执行后续操作，比如发送通知、更新缓存等。

## 39. @EventListener
- **功能简述**：Spring事件监听注解，标注方法作为事件监听器，响应特定事件，实现发布-订阅模式，组件间解耦通信。

## 40. @Profile
- **功能简述**：Spring环境注解，指定Bean在某个环境配置下才生效，如dev、test、prod，用于多环境部署时切换不同实现。

项目注解大全与解析

# 一、本项目中用到的注解

## 1. @SpringBootApplication
- **功能简述**：Spring Boot项目入口注解，组合了@Configuration、@EnableAutoConfiguration、@ComponentScan，开启自动配置和组件扫描。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类TliasWebManagementApplication.java和SpringbootWebConfigApplication.java上，标识这是Spring Boot应用入口，启动项目。
  - **源码逻辑简述**：该注解组合了三个核心注解，让Spring Boot自动扫描当前包及子包下的所有组件，自动配置依赖，无需手动配置XML。本项目中它负责启动整个Web应用，初始化Spring容器。
- **代码示例**：
```java
@SpringBootApplication
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 2. @ServletComponentScan
- **功能简述**：开启Servlet组件扫描，让Spring扫描并注册Filter、Servlet、Listener等原生Servlet组件。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类上，配合`@WebFilter`注解让TokenFilter过滤器注册到Spring容器中，完成JWT令牌校验。
  - **源码逻辑简述**：Spring启动时扫描带`@WebFilter`注解的类，注册为过滤器，TokenFilter用于拦截所有请求，在处理业务前校验JWT令牌，未携带令牌或令牌非法直接返回401。
- **代码示例**：
```java
@SpringBootApplication
@ServletComponentScan
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 3. @Target
- **功能简述**：元注解，指定自定义注解可以应用在哪些代码元素上（方法、类、字段等）。
- **本项目应用举例**：
  - **应用场景**：用在自定义注解@Log和@EnableHeaderConfig上，指定注解的使用范围。
  - **源码逻辑简述**：@Log注解指定ElementType.METHOD，表示该注解只能加在方法上，配合AOP做操作日志记录，避免误用在类或字段上。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 4. @Retention
- **功能简述**：元注解，指定自定义注解的保留策略，即注解在哪个阶段仍然保留（源码、class文件、运行时）。
- **本项目应用举例**：
  - **应用场景**：配合@Target一起用在自定义注解上，指定@Log注解在运行时保留，这样AOP切面才能通过反射读取到该注解。
  - **源码逻辑简述**：RetentionPolicy.RUNTIME表示注解一直保留到运行时，AOP切面能通过反射识别方法上是否标记了该注解，从而进行操作日志的记录，如果不是RUNTIME，运行时就获取不到注解信息了。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 5. @Log (自定义)
- **功能简述**：本项目自定义注解，用于标记需要记录操作日志的方法。
- **本项目应用举例**：
  - **应用场景**：用在DeptController、EmpController、StudentController等Controller层增删改方法上，标识这些操作需要记录操作人、操作时间、执行耗时等日志信息。
  - **源码逻辑简述**：该注解本身不包含逻辑，只是一个标记，OperationLogAspect环绕切面会拦截所有带@Log的方法，在方法执行前后记录操作信息并插入数据库，用户查看操作历史时可以追溯。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 6. @Slf4j
- **功能简述**：Lombok提供的注解，自动在类中注入org.slf4j.Logger日志对象，简化日志开发。
- **本项目应用举例**：
  - **应用场景**：几乎所有类都使用了@Slf4j，包括Controller、Service、Aspect、ExceptionHandler等，用于输出日志信息，调试和排错。
  - **源码逻辑简述**：编译阶段Lombok自动生成`private static final Logger log = LoggerFactory.getLogger(当前类.class);`代码，开发者直接使用`log.info()`、`log.error()`输出日志，不需要手动写Logger声明，减少模板代码。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    public Result list() {
        log.info("查询全部部门数据");
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 7. @Aspect
- **功能简述**：Spring AOP注解，标识一个类是切面类，包含切面逻辑（通知）。
- **本项目应用举例**：
  - **应用场景**：用在OperationLogAspect上，让Spring识别这是一个切面，用于操作日志的AOP处理。
  - **源码逻辑简述**：配合@Component注册到Spring容器，@Around定义环绕通知，拦截所有带@Log注解的方法，在方法执行前后记录操作日志并保存到数据库。
- **代码示例**：
```java
@Slf4j
@Aspect
@Component
public class OperationLogAspect {
    @Around("@annotation(org.example.anno.Log)")
    public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long costTime = System.currentTimeMillis() - startTime;
        operateLogMapper.insert(olog);
        return result;
    }
}
```

## 8. @Around
- **功能简述**：Spring AOP的环绕通知注解，指定切面方法在目标方法执行前后都执行，可以控制目标方法是否执行。
- **本项目应用举例**：
  - **应用场景**：在OperationLogAspect中使用，匹配所有带@Log注解的方法，实现操作日志记录。
  - **源码逻辑简述**：@Around注解的切点表达式匹配`@annotation(org.example.anno.Log)`，即只拦截带@Log的方法。环绕通知先记录开始时间，调用目标方法，再计算耗时，封装操作日志对象，保存到数据库。
- **代码示例**：
```java
@Around("@annotation(org.example.anno.Log)")
public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
    long startTime = System.currentTimeMillis();
    Object result = joinPoint.proceed();
    return result;
}
```

## 9. @Component
- **功能简述**：Spring通用组件注解，标识一个类为Spring管理的Bean，会被自动扫描并注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：用在多个类上，如OperationLogAspect、TokenInterceptor、AliyunOSSOperator、TokenParser等，让这些类被Spring容器管理，方便依赖注入。
  - **源码逻辑简述**：Spring组件扫描时会把带@Component的类实例化，存入IOC容器，其它类可以通过@Autowired注入使用。例如TokenInterceptor需要被WebConfig注册到拦截器链，必须先被Spring管理。
- **代码示例**：
```java
@Slf4j
@Component
public class TokenInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, ...) {
        return true;
    }
}
```

## 10. @Autowired
- **功能简述**：Spring依赖注入注解，自动从IOC容器中匹配并注入依赖对象，默认按类型匹配。
- **本项目应用举例**：
  - **应用场景**：几乎所有需要依赖注入的地方都在用，Controller注入Service，Service注入Mapper，工具类注入配置Bean等。例如DeptController注入DeptService，调用业务逻辑。
  - **源码逻辑简述**：Spring容器启动后，解析@Autowired注解，根据字段类型从容器中找到对应的Bean，反射注入到字段中，解耦了组件之间的依赖关系，不需要手动new对象。
- **代码示例**：
```java
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 11. @Configuration
- **功能简述**：Spring配置类注解，标识该类是配置类，用于定义Bean配置，替代XML配置文件。
- **本项目应用举例**：
  - **应用场景**：用在WebConfig和HeaderConfig上，注册拦截器配置或手动定义Bean。
  - **源码逻辑简述**：@Configuration类会被Spring特殊处理，其中定义的@Bean方法会被调用，返回值注册为Bean。本项目WebConfig实现WebMvcConfigurer接口注册拦截器，对请求进行拦截处理。
- **代码示例**：
```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Autowired
    private TokenInterceptor tokenInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册拦截器...
    }
}
```

## 12. @RestController
- **功能简述**：组合了@Controller和@ResponseBody，标识这是REST控制器，每个方法返回值直接写入HTTP响应体，默认返回JSON格式。
- **本项目应用举例**：
  - **应用场景**：所有Controller层类都用@RestController，如DeptController、EmpController等，前后端分离项目，接口返回JSON数据。
  - **源码逻辑简述**：方法返回的Result对象会被Spring消息转换器自动转换为JSON格式返回给前端，不需要每个方法加@ResponseBody。本项目所有接口都遵循这个约定，前端AJAX请求拿到JSON后处理。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;

    @GetMapping("/depts")
    public Result list() {
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 13. @RequestMapping
- **功能简述**：请求映射注解，指定请求路径和请求方法，将HTTP请求映射到对应的Controller方法。
- **本项目应用举例**：
  - **应用场景**：用在Controller类上提取公共路径前缀，如EmpController类上加`@RequestMapping("/emps")`，所有方法路径都以/emps开头。
  - **源码逻辑简述**：统一管理同模块接口路径，避免每个方法重复写相同前缀。本项目按业务模块划分路径，方便管理和理解接口归属。
- **代码示例**：
```java
@Slf4j
@RequestMapping("/emps")
@RestController
public class EmpController {
    @Autowired
    private EmpService empService;
}
```

## 14. @GetMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.GET，处理GET请求。
- **本项目应用举例**：
  - **应用场景**：用于查询接口，如查询部门列表、查询员工信息、分页查询等GET请求，HTTP GET用于获取数据。
  - **源码逻辑简述**：Spring框架将GET请求映射到对应方法执行，返回查询结果封装成JSON。本项目遵循REST风格，GET用于查询操作。
- **代码示例**：
```java
@GetMapping("/depts")
public Result list() {
    List<Dept> deptlist = deptService.findAll();
    return Result.success(deptlist);
}
```

## 15. @PostMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.POST，处理POST请求，一般用于新增数据。
- **本项目应用举例**：
  - **应用场景**：用于新增部门、新增员工、新增学员、文件上传、登录等POST请求。
  - **源码逻辑简述**：前端通过POST提交JSON数据给后端，后端接收并保存到数据库。本项目遵循REST风格，POST用于新增操作。
- **代码示例**：
```java
@Log
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 16. @DeleteMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.DELETE，处理DELETE请求，一般用于删除数据。
- **本项目应用举例**：
  - **应用场景**：删除部门、删除员工、删除学员等操作，遵循RESTful风格。
  - **源码逻辑简述**：前端通过DELETE请求传递要删除的ID，后端调用Service删除对应数据。本项目遵循REST风格，DELETE用于删除操作。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 17. @PutMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.PUT，处理PUT请求，一般用于更新数据。
- **本项目应用举例**：
  - **应用场景**：修改部门、修改员工、修改学员信息等更新操作。
  - **源码逻辑简述**：前端通过PUT提交修改后的完整对象，后端更新数据库对应记录。本项目遵循REST风格，PUT用于更新操作。
- **代码示例**：
```java
@Log
@PutMapping("/depts")
public Result update(@RequestBody Dept dept) {
    log.info("修改部门数据: {}",dept);
    deptService.update(dept);
    return Result.success();
}
```

## 18. @RequestParam
- **功能简述**：绑定请求参数到方法形参，指定请求参数必须携带，也可以设置默认值。
- **本项目应用举例**：
  - **应用场景**：分页查询参数，指定page和pageSize的默认值，前端不传时使用默认值，避免空指针。
  - **源码逻辑简述**：当请求参数名和方法形参名不同时，可以指定名称；required属性控制是否必须携带，defaultValue设置默认值。本项目分页查询默认第一页，每页10条数据。
- **代码示例**：
```java
@GetMapping
public Result page(String name,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate begin,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate end,
                   @RequestParam(defaultValue = "1") Integer page,
                   @RequestParam(defaultValue = "10") Integer pageSize){
    PageResult pageResult = clazzService.page(name,begin,end,page,pageSize);
    return Result.success(pageResult);
}
```

## 19. @PathVariable
- **功能简述**：绑定URL路径中的占位符参数到方法形参，用于RESTful风格的路径参数。
- **本项目应用举例**：
  - **应用场景**：根据ID查询详情，ID放在URL路径中，如`/depts/{id}`，@PathVariable获取路径中的id值。
  - **源码逻辑简述**：Spring框架会把URL中匹配占位符的值取出，赋值给方法参数。REST风格中将资源ID放在路径中比查询参数更清晰。
- **代码示例**：
```java
@GetMapping("/depts/{id}")
public Result getInfo(@PathVariable Integer id) {
    log.info("根据id查询部门数据: {}",id);
    Dept dept = deptService.getById(id);
    return Result.success(dept);
}
```

## 20. @RequestBody
- **功能简述**：绑定请求体中的JSON数据到方法参数对象，Spring自动将JSON反序列化为Java对象。
- **本项目应用举例**：
  - **应用场景**：新增、修改操作时，前端将整个对象以JSON格式放在请求体中发送给后端，后端用@RequestBody接收并封装为Java对象。
  - **源码逻辑简述**：通过HttpMessageConverter把请求体中的JSON字符串转换为指定类型的Java对象。本项目前后端分离，新增修改接口都用这个方式传参。
- **代码示例**：
```java
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 21. @DateTimeFormat
- **功能简述**：指定日期时间参数的格式化 pattern，将字符串按照指定格式解析为日期类型。
- **本项目应用举例**：
  - **应用场景**：分页查询时，前端传入字符串格式的开始日期和结束日期，后端通过@DateTimeFormat按照pattern="yyyy-MM-dd"解析为LocalDate对象。
  - **源码逻辑简述**：Spring MVC在绑定请求参数时，根据pattern格式解析字符串到日期类型，如果格式不匹配会报错。本项目在查询参数EmpQueryParam和Controller方法参数上都使用了。
- **代码示例**：
```java
@Data
public class EmpQueryParam {
    private Integer page = 1;
    private Integer pageSize = 5;
    private String name;
    private Integer gender;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate begin;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate end;
}
```

## 22. @WebFilter
- **功能简述**：原生Servlet注解，声明一个过滤器，指定过滤的URL路径。
- **本项目应用举例**：
  - **应用场景**：用在TokenFilter上，`urlPatterns = "/*"`表示拦截所有请求，在请求到达Servlet之前校验JWT令牌。
  - **源码逻辑简述**：配合@ServletComponentScan，Spring启动时会将过滤器注册到Servlet容器，对所有请求进行拦截处理。TokenFilter从中获取请求头中的token，校验失败直接返回401。
- **代码示例**：
```java
@Slf4j
@WebFilter(urlPatterns = "/*")
public class TokenFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        // 校验JWT令牌...
    }
}
```

## 23. @RestControllerAdvice
- **功能简述**：组合了@ControllerAdvice和@ResponseBody，用于全局异常处理，捕获所有Controller抛出的异常，统一处理返回JSON。
- **本项目应用举例**：
  - **应用场景**：用在GlobalExceptionHandler上，统一处理所有Controller抛出的异常，返回友好的错误提示。
  - **源码逻辑简述**：Spring捕获Controller抛出的异常后，会交给@RestControllerAdvice类中带@ExceptionHandler的方法处理，本项目对不同异常分类处理，统一封装为Result错误格式返回前端。
- **代码示例**：
```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler
    public Result handleException(Exception e){
        log.error("程序出错了 ",e);
        return Result.error("程序异常");
    }
}
```

## 24. @ExceptionHandler
- **功能简述**：指定处理哪种类型的异常，方法会处理该类型及其子类异常。
- **本项目应用举例**：
  - **应用场景**：在GlobalExceptionHandler中使用，分别处理Exception、DuplicateKeyException、BusinessException，不同异常返回不同错误提示。
  - **源码逻辑简述**：当Controller抛出指定类型的异常时，对应的@ExceptionHandler方法会被调用，本项目中唯一键冲突异常会提取出重复值信息返回，业务异常直接返回错误消息，其它异常返回通用"程序异常"。
- **代码示例**：
```java
@ExceptionHandler(BusinessException.class)
public Result handleBusinessException(BusinessException e){
    log.error("服务器异常: ", e);
    return Result.error(e.getMessage());
}
```

## 25. @Service
- **功能简述**：Spring业务逻辑层组件注解，标识这是Service层Bean，会被组件扫描注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：所有Service实现类都用@Service，如DeptServiceImpl、EmpServiceImpl等，Controller注入Service调用业务逻辑。
  - **源码逻辑简述**：本质和@Component一样，语义更清晰，标识这是业务逻辑层组件，分工更明确。Service层调用Mapper层完成业务处理，事务管理也加在Service层。
- **代码示例**：
```java
@Service
public class DeptServiceImpl implements DeptService {
    @Autowired
    private DeptMapper deptMapper;
}
```

## 26. @Transactional
- **功能简述**：Spring声明式事务注解，开启事务管理，指定方法执行出现异常时自动回滚事务。
- **本项目应用举例**：
  - **应用场景**：用在需要事务保护的Service方法上，如新增员工同时插入员工表和工作经历表，删除员工同时删除两张表，必须保证原子性，要么都成功要么都失败。
  - **源码逻辑简述**：方法进入时Spring开启事务，方法执行完毕如果抛出异常（指定rollbackFor范围内）自动回滚，没有异常提交事务。本项目设置`rollbackFor = Exception.class`表示所有异常都回滚，包括非运行时异常。
- **代码示例**：
```java
@Transactional(rollbackFor = {Exception.class})
@Override
public void save(Emp emp){
    emp.setCreateTime(LocalDateTime.now());
    emp.setUpdateTime(LocalDateTime.now());
    empMapper.insert(emp);
    List<EmpExpr> exprList = emp.getExprList();
    if(!CollectionUtils.isEmpty(exprList)){
        exprList.forEach(expr -> expr.setEmpId(emp.getId()));
        empExprMapper.insertBatch(exprList);
    }
}
```

## 27. Propagation (事务传播机制)
- **功能简述**：配合@Transactional使用，指定事务传播行为，即多个带事务方法互相调用时事务如何传播。
- **本项目应用举例**：
  - **应用场景**：在EmpLogServiceImpl.insertLog方法上使用`propagation = Propagation.REQUIRES_NEW`，表示无论调用方是否有事务，该方法都必须开启一个新事务，新事务独立于原有事务。
  - **源码逻辑简述**：insertLog不管外层事务是否成功，日志都要记录成功，不能因为外层事务回滚导致日志也回滚不记录。REQUIRES_NEW挂起原有事务，开启新事务执行，执行完恢复原有事务。
- **代码示例**：
```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
@Override
public void insertLog(EmpLog empLog) {
    empLogMapper.insert(empLog);
}
```

## 28. @Mapper
- **功能简述**：MyBatis注解，标识这是MyBatis的Mapper接口，MyBatis自动生成该接口的代理实现类，注册到Spring容器。
- **本项目应用举例**：
  - **应用场景**：所有MyBatis Mapper接口都加@Mapper，如DeptMapper、EmpMapper，Service注入Mapper调用数据库操作。
  - **源码逻辑简述**：MyBatis启动扫描所有@Mapper接口，动态生成代理对象，处理SQL执行和结果映射，把代理对象交给Spring管理，Service就能直接注入使用。
- **代码示例**：
```java
@Mapper
public interface DeptMapper {
    @Select("select id, name, create_time, update_time from dept order by update_time desc;")
    List<Dept> findAll();
}
```

## 29. @Select
- **功能简述**：MyBatis注解，标注查询SQL，直接在注解上写SELECT语句，不需要XML映射文件。
- **本项目应用举例**：
  - **应用场景**：简单查询直接使用@Select写SQL，复杂查询使用XML，本项目DeptMapper简单查询都用注解方式。
  - **源码逻辑简述**：MyBatis执行方法时提取注解中的SQL，执行查询，自动将结果映射到返回值类型。对于单表简单查询，注解比XML更简洁。
- **代码示例**：
```java
@Select("select id, name, create_time, update_time from dept where id = #{id}")
Dept getById(Integer id);
```

## 30. @Insert
- **功能简述**：MyBatis注解，标注插入SQL，直接在注解上写INSERT语句。
- **本项目应用举例**：
  - **应用场景**：简单插入操作使用@Insert写SQL，如新增部门、插入操作日志等。
  - **源码逻辑简述**：MyBatis解析参数，执行INSERT语句，返回影响行数。配合@Options可以配置主键回写。
- **代码示例**：
```java
@Insert("insert into dept(name, create_time, update_time) values(#{name}, #{createTime}, #{updateTime});")
void insert(Dept dept);
```

## 31. @Delete
- **功能简述**：MyBatis注解，标注删除SQL，直接在注解上写DELETE语句。
- **本项目应用举例**：
  - **应用场景**：简单删除操作使用@Delete写SQL。
  - **源码逻辑简述**：MyBatis执行DELETE语句，返回影响行数。
- **代码示例**：
```java
@Delete("delete from dept where id = #{id};")
void deleteById(Integer id);
```

## 32. @Update (MyBatis)
- **功能简述**：MyBatis注解，标注更新SQL，直接在注解上写UPDATE语句。
- **本项目应用举例**：
  - **应用场景**：简单更新操作使用@Update写SQL。
  - **源码逻辑简述**：MyBatis执行UPDATE语句，返回影响行数。
- **代码示例**：
```java
@Update("update dept set name = #{name}, update_time = #{updateTime} where id = #{id}")
void update(Dept dept);
```

## 33. @Options
- **功能简述**：MyBatis注解，配置映射选项，支持配置主键生成、超时等。
- **本项目应用举例**：
  - **应用场景**：在EmpMapper.insert上使用`useGeneratedKeys = true, keyProperty = "id"`，配置主键回写，插入数据后自动把数据库生成的自增主键回写到Emp对象的id属性。
  - **源码逻辑简述**：插入成功后MyBatis从数据库获取生成的自增主键，赋值给keyProperty指定的属性。因为插入员工后需要用到员工id插入工作经历列表，所以必须回写主键。
- **代码示例**：
```java
@Options(useGeneratedKeys = true, keyProperty = "id")
@Insert("insert into emp(username, name, gender, phone, job, salary, image, entry_date, dept_id, create_time, update_time)" +
        "values (#{username},#{name},#{gender},#{phone},#{job},#{salary},#{image},#{entryDate},#{deptId},#{createTime},#{updateTime})")
void insert(Emp emp);
```

## 34. @MapKey
- **功能简述**：MyBatis注解，指定将查询结果的哪一列作为Map的key，封装为Map返回。
- **本项目应用举例**：
  - **应用场景**：在统计查询方法上使用，将统计结果按指定列分组封装。
  - **源码逻辑简述**：MyBatis查询结果转换后，以@MapKey指定字段的值作为key封装成Map，方便后续处理。本项目统计职位人数和性别人数都使用了。
- **代码示例**：
```java
@MapKey("pos")
List<Map<String,Object>> countEmpJobData();

@MapKey("name")
List<Map<String, Object>> countEmpGenderData();
```

## 35. @Data
- **功能简述**：Lombok注解，自动生成getter、setter、toString、equals、hashCode方法。
- **本项目应用举例**：
  - **应用场景**：所有POJO类、实体类、配置属性类都使用@Data，如Result、Emp、AliyunOSSProperties等，消除样板代码。
  - **源码逻辑简述**：编译阶段Lombok自动为类生成所有字段的getter、setter等方法，开发者不需要手动写，代码更简洁，修改字段属性不需要修改这些方法。
- **代码示例**：
```java
@Data
public class Result {
    private Integer code;
    private String msg;
    private Object data;
}
```

## 36. @NoArgsConstructor
- **功能简述**：Lombok注解，自动生成无参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要无参构造器的实体类上使用，如PageResult、Student、Clazz，框架反射创建对象需要无参构造器。
  - **源码逻辑简述**：当类中已经有全参构造器时，Java不会默认生成无参构造器，所以需要显式加@NoArgsConstructor生成，配合@AllArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 37. @AllArgsConstructor
- **功能简述**：Lombok注解，自动生成全参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要全参构造的实体类上使用，如PageResult，创建对象时可以一次性给所有属性赋值。
  - **源码逻辑简述**：Lombok编译生成包含所有字段的构造器，方便通过构造器注入属性值，配合@NoArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 38. @Value (Spring)
- **功能简述**：Spring注解，从配置文件中注入单个配置属性值到字段。
- **本项目应用举例**：
  - **应用场景**：AliyunOSSOperator注释代码中使用@Value注入OSS配置，注释掉的代码演示了@Value用法，实际项目改用@ConfigurationProperties。
  - **源码逻辑简述**：Spring启动时解析${}占位符，从application.yml中取出对应配置赋值给字段。适合单个少量配置属性注入。
- **代码示例**：
```java
@Value("${aliyun.oss.endpoint}")
private String endpoint;
```

## 39. @ConfigurationProperties
- **功能简述**：Spring Boot注解，批量注入配置文件中前缀匹配的属性到JavaBean，类型安全的配置绑定。
- **本项目应用举例**：
  - **应用场景**：在AliyunOSSProperties上使用，prefix = "aliyun.oss"，将配置文件中所有以aliyun.oss开头的配置绑定到对应的字段。
  - **源码逻辑简述**：Spring Boot自动配置根据前缀匹配，将配置文件中的值按照字段名映射注入，比多个@Value更整洁，支持批量绑定，IDE也能自动提示。
- **代码示例**：
```java
@Data
@Component
@ConfigurationProperties(prefix = "aliyun.oss")
public class AliyunOSSProperties {
    private String endpoint;
    private String bucketName;
    private String region;
}
```

## 40. @Import
- **功能简述**：Spring注解，手动导入指定的类到Spring容器，一般用在注解上导入配置类。
- **本项目应用举例**：
  - **应用场景**：在自定义注解@EnableHeaderConfig上使用@Import导入MyImportSelector，实现按需导入配置。
  - **源码逻辑简述**：@Import导入MyImportSelector，MyImportSelector实现ImportSelector接口返回需要导入的配置类全限定名，Spring注册这些配置类到容器，实现模块化装配。这个例子演示了如何开发一个需要开启注解才能使用的功能模块。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

## 41. @Bean
- **功能简述**：Spring注解，用在@Configuration类中，声明方法返回值是一个Bean，交给Spring容器管理。
- **本项目应用举例**：
  - **应用场景**：SpringbootWebConfigApplication中使用@Bean方法注册AliyunOSSOperator，接收参数注入AliyunOSSProperties。也在HeaderConfig中注册HeaderParser和HeaderGenerator。
  - **源码逻辑简述**：调用方法获取返回值，将返回值注册为Bean存入IOC容器，方法参数自动从容器注入依赖。适合把第三方类实例化为Bean交给Spring管理，本项目演示了这种用法。
- **代码示例**：
```java
@Bean
public AliyunOSSOperator aliyunOSSOperator(AliyunOSSProperties aliyunOSSProperties){
    return new AliyunOSSOperator(aliyunOSSProperties);
}
```

## 42. @Scope
- **功能简述**：Spring注解，指定Bean的作用域（单例、多例等）。
- **本项目应用举例**：
  - **应用场景**：在DeptController中使用`@Scope("prototype")`，演示多例模式，每次请求创建新的Controller实例。
  - **源码逻辑简述**：默认是singleton单例，全局只有一个实例；prototype多例，每次获取Bean都创建新实例。这个示例演示了作用域的用法，实际项目Controller一般都是单例。
- **代码示例**：
```java
@Scope("prototype")
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 43. @SpringBootTest
- **功能简述**：Spring Boot测试注解，标识这是一个Spring Boot单元测试类，会启动Spring容器。
- **本项目应用举例**：
  - **应用场景**：用在测试类上，整合Spring进行单元测试，可以注入容器中的Bean进行测试。
  - **源码逻辑简述**：JUnit测试启动时加载Spring Boot应用上下文，创建Spring容器，测试方法可以使用@Autowired注入Bean测试功能。本项目测试类使用了该注解。
- **代码示例**：
```java
@SpringBootTest
class SpringbootWebTests {
    @Autowired
    private DeptService deptService;
}
```

## 44. @Test
- **功能简述**：JUnit测试注解，标识这是一个测试方法，可以被JUnit运行器执行。
- **本项目应用举例**：
  - **应用场景**：测试类中的每个测试方法都加@Test，单元测试单独功能。
  - **源码逻辑简述**：JUnit执行测试时运行所有带@Test的方法，断言结果，输出测试报告。本项目演示了单元测试的写法。
- **代码示例**：
```java
@Test
void contextLoads() {
}
```

## 45. @EnableHeaderConfig (自定义)
- **功能简述**：本项目自定义开启注解，用于开启Header相关功能配置，演示基于注解的模块装配。
- **本项目应用举例**：
  - **应用场景**：在itheima-utils模块中定义，用户只需要在启动类上加上这个注解就能自动导入Header相关配置，不需要手动配置多个Bean。这是Spring Boot自动配置的雏形。
  - **源码逻辑简述**：该注解用@Import导入MyImportSelector，MyImportSelector返回HeaderConfig的全类名，Spring注册HeaderConfig，HeaderConfig定义了HeaderParser和HeaderGenerator两个Bean，实现一键开启功能。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

---

# 二、本项目中未用到但常用的注解

## 1. @Controller
- **功能简述**：Spring控制器注解，标识这是MVC模式的Controller，配合视图解析器返回视图页面，如果要返回JSON需要方法或类上加@ResponseBody。前后端不分离项目常用，本项目前后端分离用@RestController替代。

## 2. @ResponseBody
- **功能简述**：将方法返回值直接写入HTTP响应体，一般返回JSON格式数据。在@RestController出现之前，通常@Controller搭配@ResponseBody使用。

## 3. @Qualifier
- **功能简述**：配合@Autowired使用，当同一个接口有多个实现类时，通过@Qualifier指定按名称注入，解决同类型多个Bean的歧义问题。@Autowired默认按类型匹配，找不到唯一匹配时需要@Qualifier指定名称。

## 4. @Resource
- **功能简述**：Java JSR-250规范提供的依赖注入注解，默认按名称匹配，找不到再按类型匹配，是Spring支持的另一种依赖注入方式，和@Autowired功能类似但匹配规则不同。

## 5. @ComponentScan
- **功能简述**：指定Spring组件扫描的包路径，@SpringBootApplication已经包含了这个注解，默认扫描启动类当前包及其子包。需要自定义扫描范围时使用。

## 6. @ConfigurationPropertiesScan
- **功能简述**：Spring Boot注解，指定扫描哪些包下的@ConfigurationProperties配置类，自动注册到容器。开启对@ConfigurationProperties的扫描支持。

## 7. @EnableAutoConfiguration
- **功能简述**：Spring Boot自动配置注解，告诉Spring Boot根据类路径下的依赖自动配置项目，比如引入了spring-boot-starter-web就自动配置Tomcat和Spring MVC。@SpringBootApplication已经包含了这个注解。

## 8. @Conditional
- **功能简述**：Spring条件注解，满足条件才注册Bean到容器，Spring Boot自动配置大量使用这个注解，根据条件决定是否配置。派生注解有@ConditionalOnClass、@ConditionalOnProperty、@ConditionalOnMissingBean等。

## 9. @Lazy
- **功能简述**：开启懒加载，Bean不在容器启动时创建，第一次使用时才创建，加快项目启动速度，节省内存。适合不常用的Bean。本项目代码注释中有示例，但实际未启用。

## 10. @Primary
- **功能简述**：当同一个接口有多个实现Bean时，指定哪个是主要候选者，自动注入时优先选择这个Bean，解决歧义问题，比@Qualifier更简洁。

## 11. @SessionAttributes
- **功能简述**：将模型中的属性存储到Session域，用于在多个请求之间共享数据，传统MVC开发中使用，前后端分离项目很少用。

## 12. @CookieValue
- **功能简述**：绑定Cookie中的值到方法参数，获取指定Cookie的值，需要读取Cookie信息时使用。

## 13. @RequestHeader
- **功能简述**：绑定请求头到方法参数，获取指定请求头的值，需要读取请求头信息时使用，比如获取User-Agent、Authorization等。

## 14. @CrossOrigin
- **功能简述**：开启跨域支持，标注在Controller或方法上，允许跨域请求。Spring MVC会自动处理跨域预检请求，设置正确的CORS响应头。项目一般通过全局CORS配置或网关处理跨域，局部也可以用这个注解。

## 15. @Repository
- **功能简述**：Spring持久层组件注解，作用和@Component类似，语义更清晰，标识这是DAO/Mapper层组件。现在MyBatis项目一般用@Mapper，比@Repository更方便。

## 16. @Param
- **功能简述**：MyBatis注解，为Mapper接口方法参数指定名称，映射到SQL中的#{name}占位符，多个参数时必须加@Param指定名称。如果接口只有一个简单参数可以省略。

## 17. @Results / @Result
- **功能简述**：MyBatis注解，配置自定义结果映射，映射查询结果列到Java对象属性，解决列名和属性名不匹配的问题，复杂结果映射可以使用这个注解，一般简单查询不需要。

## 18. @OneToMany / @ManyToOne / @OneToOne
- **功能简述**：JPA/Hibernate关联注解，配置实体之间的关联关系，一对多、多对一、一对一关联。MyBatis项目一般不需要这些注解，JPA项目大量使用。

## 19. @Entity
- **功能简述**：JPA注解，标识这是一个实体类，对应数据库表，JPA项目每个实体类需要加这个注解。

## 20. @Id / @GeneratedValue
- **功能简述**：JPA注解，@Id标识主键字段，@GeneratedValue指定主键生成策略（自增、序列、UUID等）。

## 21. @Override
- **功能简述**：Java元注解，标识方法重写父接口/父类的方法，编译器会检查是否正确重写，这是一个标记注解，不影响运行，只是帮助编译器检查，好的编码习惯都会加上。

## 22. @Deprecated
- **功能简述**：Java元注解，标识方法、类、字段已过时，不推荐使用，编译器会发出警告，一般有更好的替代方案。

## 23. @SuppressWarnings
- **功能简述**：Java元注解，抑制编译器指定类型的警告，告诉编译器这里不需要警告，代码是故意这么写的。

## 24. @NonNull / @Nullable
- **功能简述**：JetBrains/Java注解，标记参数或返回值是否可以为null，IDE会给出空指针警告，静态代码检查帮助提前发现空指针问题。

## 25. @Valid / @Validated
- **功能简述**：Spring参数校验注解，开启JSR-303数据校验，对方法参数进行校验，配合@NotNull、@Min、@Max等约束注解使用，不满足约束时抛出BindException。接口入参校验常用。

## 26. @NotNull / @NotEmpty / @NotBlank
- **功能简述**：Bean Validation约束注解，校验参数不为null、不为空字符串、不为空白，数据校验常用，配合@Valid使用。

## 27. @Async
- **功能简述**：Spring异步方法注解，标注方法会在异步线程中执行，不阻塞主线程，需要在配置类上加@EnableAsync开启异步支持。适合发邮件、记录日志等不需要同步等待的操作。

## 28. @Scheduled
- **功能简述**：Spring定时任务注解，指定方法定时执行，支持cron表达式、固定延迟、固定频率，需要在配置类上加@EnableScheduling开启定时任务。项目定时任务使用。

## 29. @ControllerAdvice
- **功能简述**：Spring全局增强注解，可以用于全局异常处理、全局数据绑定、全局数据预处理，配合@ExceptionHandler做全局异常处理，本项目用@RestControllerAdvice（组合了@ControllerAdvice+@ResponseBody）。

## 30. @PostConstruct
- **功能简述**：Java注解，标记方法在Bean构造完成、依赖注入完成后执行，做一些初始化工作，在Bean生命周期中执行一次。

## 31. @PreDestroy
- **功能简述**：Java注解，标记方法在Bean销毁前执行，做一些清理工作，释放资源。

## 32. @Cacheable / @CacheEvict / @CachePut
- **功能简述**：Spring缓存注解，@Cacheable将方法返回值缓存，下次相同参数直接从缓存取；@CacheEvict清理缓存；@CachePut更新缓存。需要开启缓存后使用，提升查询性能减轻数据库压力。

## 33. @FeignClient
- **功能简述**：Spring Cloud OpenFeign注解，声明这是一个HTTP客户端接口，OpenFeign自动生成实现，调用其他微服务接口。微服务项目常用。

## 34. @PatchMapping
- **功能简述**：快捷注解，对应PATCH请求方法，RESTful风格常用于部分更新，本项目使用PUT做全量更新，没有用到PATCH。

## 35. @Order
- **功能简述**：Spring注解，指定Bean的排序，值越小优先级越高，多个拦截器、过滤器排序时使用，控制执行顺序。

## 36. @PropertySource
- **功能简述**：Spring注解，指定加载额外的properties配置文件，引入外部配置文件。Spring Boot自动加载application.properties/yml，一般不需要，自定义配置文件时使用。

## 37. @ImportResource
- **功能简述**：Spring注解，导入Spring XML配置文件，兼容老项目的XML配置，现在全注解开发很少用。

## 38. @TransactionalEventListener
- **功能简述**：Spring事件监听注解，监听事务提交后事件，实现业务解耦，事务提交后再执行后续操作，比如发送通知、更新缓存等。

## 39. @EventListener
- **功能简述**：Spring事件监听注解，标注方法作为事件监听器，响应特定事件，实现发布-订阅模式，组件间解耦通信。

## 40. @Profile
- **功能简述**：Spring环境注解，指定Bean在某个环境配置下才生效，如dev、test、prod，用于多环境部署时切换不同实现。

项目注解大全与解析

# 一、本项目中用到的注解

## 1. @SpringBootApplication
- **功能简述**：Spring Boot项目入口注解，组合了@Configuration、@EnableAutoConfiguration、@ComponentScan，开启自动配置和组件扫描。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类TliasWebManagementApplication.java和SpringbootWebConfigApplication.java上，标识这是Spring Boot应用入口，启动项目。
  - **源码逻辑简述**：该注解组合了三个核心注解，让Spring Boot自动扫描当前包及子包下的所有组件，自动配置依赖，无需手动配置XML。本项目中它负责启动整个Web应用，初始化Spring容器。
- **代码示例**：
```java
@SpringBootApplication
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 2. @ServletComponentScan
- **功能简述**：开启Servlet组件扫描，让Spring扫描并注册Filter、Servlet、Listener等原生Servlet组件。
- **本项目应用举例**：
  - **应用场景**：用在项目启动类上，配合`@WebFilter`注解让TokenFilter过滤器注册到Spring容器中，完成JWT令牌校验。
  - **源码逻辑简述**：Spring启动时扫描带`@WebFilter`注解的类，注册为过滤器，TokenFilter用于拦截所有请求，在处理业务前校验JWT令牌，未携带令牌或令牌非法直接返回401。
- **代码示例**：
```java
@SpringBootApplication
@ServletComponentScan
public class TliasWebManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(TliasWebManagementApplication.class, args);
    }
}
```

## 3. @Target
- **功能简述**：元注解，指定自定义注解可以应用在哪些代码元素上（方法、类、字段等）。
- **本项目应用举例**：
  - **应用场景**：用在自定义注解@Log和@EnableHeaderConfig上，指定注解的使用范围。
  - **源码逻辑简述**：@Log注解指定ElementType.METHOD，表示该注解只能加在方法上，配合AOP做操作日志记录，避免误用在类或字段上。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 4. @Retention
- **功能简述**：元注解，指定自定义注解的保留策略，即注解在哪个阶段仍然保留（源码、class文件、运行时）。
- **本项目应用举例**：
  - **应用场景**：配合@Target一起用在自定义注解上，指定@Log注解在运行时保留，这样AOP切面才能通过反射读取到该注解。
  - **源码逻辑简述**：RetentionPolicy.RUNTIME表示注解一直保留到运行时，AOP切面能通过反射识别方法上是否标记了该注解，从而进行操作日志的记录，如果不是RUNTIME，运行时就获取不到注解信息了。
- **代码示例**：
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
}
```

## 5. @Log (自定义)
- **功能简述**：本项目自定义注解，用于标记需要记录操作日志的方法。
- **本项目应用举例**：
  - **应用场景**：用在DeptController、EmpController、StudentController等Controller层增删改方法上，标识这些操作需要记录操作人、操作时间、执行耗时等日志信息。
  - **源码逻辑简述**：该注解本身不包含逻辑，只是一个标记，OperationLogAspect环绕切面会拦截所有带@Log的方法，在方法执行前后记录操作信息并插入数据库，用户查看操作历史时可以追溯。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 6. @Slf4j
- **功能简述**：Lombok提供的注解，自动在类中注入org.slf4j.Logger日志对象，简化日志开发。
- **本项目应用举例**：
  - **应用场景**：几乎所有类都使用了@Slf4j，包括Controller、Service、Aspect、ExceptionHandler等，用于输出日志信息，调试和排错。
  - **源码逻辑简述**：编译阶段Lombok自动生成`private static final Logger log = LoggerFactory.getLogger(当前类.class);`代码，开发者直接使用`log.info()`、`log.error()`输出日志，不需要手动写Logger声明，减少模板代码。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    public Result list() {
        log.info("查询全部部门数据");
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 7. @Aspect
- **功能简述**：Spring AOP注解，标识一个类是切面类，包含切面逻辑（通知）。
- **本项目应用举例**：
  - **应用场景**：用在OperationLogAspect上，让Spring识别这是一个切面，用于操作日志的AOP处理。
  - **源码逻辑简述**：配合@Component注册到Spring容器，@Around定义环绕通知，拦截所有带@Log注解的方法，在方法执行前后记录操作日志并保存到数据库。
- **代码示例**：
```java
@Slf4j
@Aspect
@Component
public class OperationLogAspect {
    @Around("@annotation(org.example.anno.Log)")
    public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long costTime = System.currentTimeMillis() - startTime;
        operateLogMapper.insert(olog);
        return result;
    }
}
```

## 8. @Around
- **功能简述**：Spring AOP的环绕通知注解，指定切面方法在目标方法执行前后都执行，可以控制目标方法是否执行。
- **本项目应用举例**：
  - **应用场景**：在OperationLogAspect中使用，匹配所有带@Log注解的方法，实现操作日志记录。
  - **源码逻辑简述**：@Around注解的切点表达式匹配`@annotation(org.example.anno.Log)`，即只拦截带@Log的方法。环绕通知先记录开始时间，调用目标方法，再计算耗时，封装操作日志对象，保存到数据库。
- **代码示例**：
```java
@Around("@annotation(org.example.anno.Log)")
public Object logOperation(ProceedingJoinPoint joinPoint) throws Throwable {
    long startTime = System.currentTimeMillis();
    Object result = joinPoint.proceed();
    return result;
}
```

## 9. @Component
- **功能简述**：Spring通用组件注解，标识一个类为Spring管理的Bean，会被自动扫描并注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：用在多个类上，如OperationLogAspect、TokenInterceptor、AliyunOSSOperator、TokenParser等，让这些类被Spring容器管理，方便依赖注入。
  - **源码逻辑简述**：Spring组件扫描时会把带@Component的类实例化，存入IOC容器，其它类可以通过@Autowired注入使用。例如TokenInterceptor需要被WebConfig注册到拦截器链，必须先被Spring管理。
- **代码示例**：
```java
@Slf4j
@Component
public class TokenInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, ...) {
        return true;
    }
}
```

## 10. @Autowired
- **功能简述**：Spring依赖注入注解，自动从IOC容器中匹配并注入依赖对象，默认按类型匹配。
- **本项目应用举例**：
  - **应用场景**：几乎所有需要依赖注入的地方都在用，Controller注入Service，Service注入Mapper，工具类注入配置Bean等。例如DeptController注入DeptService，调用业务逻辑。
  - **源码逻辑简述**：Spring容器启动后，解析@Autowired注解，根据字段类型从容器中找到对应的Bean，反射注入到字段中，解耦了组件之间的依赖关系，不需要手动new对象。
- **代码示例**：
```java
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 11. @Configuration
- **功能简述**：Spring配置类注解，标识该类是配置类，用于定义Bean配置，替代XML配置文件。
- **本项目应用举例**：
  - **应用场景**：用在WebConfig和HeaderConfig上，注册拦截器配置或手动定义Bean。
  - **源码逻辑简述**：@Configuration类会被Spring特殊处理，其中定义的@Bean方法会被调用，返回值注册为Bean。本项目WebConfig实现WebMvcConfigurer接口注册拦截器，对请求进行拦截处理。
- **代码示例**：
```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Autowired
    private TokenInterceptor tokenInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册拦截器...
    }
}
```

## 12. @RestController
- **功能简述**：组合了@Controller和@ResponseBody，标识这是REST控制器，每个方法返回值直接写入HTTP响应体，默认返回JSON格式。
- **本项目应用举例**：
  - **应用场景**：所有Controller层类都用@RestController，如DeptController、EmpController等，前后端分离项目，接口返回JSON数据。
  - **源码逻辑简述**：方法返回的Result对象会被Spring消息转换器自动转换为JSON格式返回给前端，不需要每个方法加@ResponseBody。本项目所有接口都遵循这个约定，前端AJAX请求拿到JSON后处理。
- **代码示例**：
```java
@Slf4j
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;

    @GetMapping("/depts")
    public Result list() {
        List<Dept> deptlist = deptService.findAll();
        return Result.success(deptlist);
    }
}
```

## 13. @RequestMapping
- **功能简述**：请求映射注解，指定请求路径和请求方法，将HTTP请求映射到对应的Controller方法。
- **本项目应用举例**：
  - **应用场景**：用在Controller类上提取公共路径前缀，如EmpController类上加`@RequestMapping("/emps")`，所有方法路径都以/emps开头。
  - **源码逻辑简述**：统一管理同模块接口路径，避免每个方法重复写相同前缀。本项目按业务模块划分路径，方便管理和理解接口归属。
- **代码示例**：
```java
@Slf4j
@RequestMapping("/emps")
@RestController
public class EmpController {
    @Autowired
    private EmpService empService;
}
```

## 14. @GetMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.GET，处理GET请求。
- **本项目应用举例**：
  - **应用场景**：用于查询接口，如查询部门列表、查询员工信息、分页查询等GET请求，HTTP GET用于获取数据。
  - **源码逻辑简述**：Spring框架将GET请求映射到对应方法执行，返回查询结果封装成JSON。本项目遵循REST风格，GET用于查询操作。
- **代码示例**：
```java
@GetMapping("/depts")
public Result list() {
    List<Dept> deptlist = deptService.findAll();
    return Result.success(deptlist);
}
```

## 15. @PostMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.POST，处理POST请求，一般用于新增数据。
- **本项目应用举例**：
  - **应用场景**：用于新增部门、新增员工、新增学员、文件上传、登录等POST请求。
  - **源码逻辑简述**：前端通过POST提交JSON数据给后端，后端接收并保存到数据库。本项目遵循REST风格，POST用于新增操作。
- **代码示例**：
```java
@Log
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 16. @DeleteMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.DELETE，处理DELETE请求，一般用于删除数据。
- **本项目应用举例**：
  - **应用场景**：删除部门、删除员工、删除学员等操作，遵循RESTful风格。
  - **源码逻辑简述**：前端通过DELETE请求传递要删除的ID，后端调用Service删除对应数据。本项目遵循REST风格，DELETE用于删除操作。
- **代码示例**：
```java
@Log
@DeleteMapping("/depts")
public Result delete(Integer id) {
    log.info("删除部门数据: {}",id);
    deptService.deleteById(id);
    return Result.success();
}
```

## 17. @PutMapping
- **功能简述**：快捷注解，组合了@RequestMapping和method = RequestMethod.PUT，处理PUT请求，一般用于更新数据。
- **本项目应用举例**：
  - **应用场景**：修改部门、修改员工、修改学员信息等更新操作。
  - **源码逻辑简述**：前端通过PUT提交修改后的完整对象，后端更新数据库对应记录。本项目遵循REST风格，PUT用于更新操作。
- **代码示例**：
```java
@Log
@PutMapping("/depts")
public Result update(@RequestBody Dept dept) {
    log.info("修改部门数据: {}",dept);
    deptService.update(dept);
    return Result.success();
}
```

## 18. @RequestParam
- **功能简述**：绑定请求参数到方法形参，指定请求参数必须携带，也可以设置默认值。
- **本项目应用举例**：
  - **应用场景**：分页查询参数，指定page和pageSize的默认值，前端不传时使用默认值，避免空指针。
  - **源码逻辑简述**：当请求参数名和方法形参名不同时，可以指定名称；required属性控制是否必须携带，defaultValue设置默认值。本项目分页查询默认第一页，每页10条数据。
- **代码示例**：
```java
@GetMapping
public Result page(String name,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate begin,
                   @DateTimeFormat(pattern = "yyyy-MM-dd")LocalDate end,
                   @RequestParam(defaultValue = "1") Integer page,
                   @RequestParam(defaultValue = "10") Integer pageSize){
    PageResult pageResult = clazzService.page(name,begin,end,page,pageSize);
    return Result.success(pageResult);
}
```

## 19. @PathVariable
- **功能简述**：绑定URL路径中的占位符参数到方法形参，用于RESTful风格的路径参数。
- **本项目应用举例**：
  - **应用场景**：根据ID查询详情，ID放在URL路径中，如`/depts/{id}`，@PathVariable获取路径中的id值。
  - **源码逻辑简述**：Spring框架会把URL中匹配占位符的值取出，赋值给方法参数。REST风格中将资源ID放在路径中比查询参数更清晰。
- **代码示例**：
```java
@GetMapping("/depts/{id}")
public Result getInfo(@PathVariable Integer id) {
    log.info("根据id查询部门数据: {}",id);
    Dept dept = deptService.getById(id);
    return Result.success(dept);
}
```

## 20. @RequestBody
- **功能简述**：绑定请求体中的JSON数据到方法参数对象，Spring自动将JSON反序列化为Java对象。
- **本项目应用举例**：
  - **应用场景**：新增、修改操作时，前端将整个对象以JSON格式放在请求体中发送给后端，后端用@RequestBody接收并封装为Java对象。
  - **源码逻辑简述**：通过HttpMessageConverter把请求体中的JSON字符串转换为指定类型的Java对象。本项目前后端分离，新增修改接口都用这个方式传参。
- **代码示例**：
```java
@PostMapping("/depts")
public Result add(@RequestBody Dept dept) {
    log.info("新增部门: {}",dept);
    deptService.add(dept);
    return Result.success();
}
```

## 21. @DateTimeFormat
- **功能简述**：指定日期时间参数的格式化 pattern，将字符串按照指定格式解析为日期类型。
- **本项目应用举例**：
  - **应用场景**：分页查询时，前端传入字符串格式的开始日期和结束日期，后端通过@DateTimeFormat按照pattern="yyyy-MM-dd"解析为LocalDate对象。
  - **源码逻辑简述**：Spring MVC在绑定请求参数时，根据pattern格式解析字符串到日期类型，如果格式不匹配会报错。本项目在查询参数EmpQueryParam和Controller方法参数上都使用了。
- **代码示例**：
```java
@Data
public class EmpQueryParam {
    private Integer page = 1;
    private Integer pageSize = 5;
    private String name;
    private Integer gender;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate begin;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate end;
}
```

## 22. @WebFilter
- **功能简述**：原生Servlet注解，声明一个过滤器，指定过滤的URL路径。
- **本项目应用举例**：
  - **应用场景**：用在TokenFilter上，`urlPatterns = "/*"`表示拦截所有请求，在请求到达Servlet之前校验JWT令牌。
  - **源码逻辑简述**：配合@ServletComponentScan，Spring启动时会将过滤器注册到Servlet容器，对所有请求进行拦截处理。TokenFilter从中获取请求头中的token，校验失败直接返回401。
- **代码示例**：
```java
@Slf4j
@WebFilter(urlPatterns = "/*")
public class TokenFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        // 校验JWT令牌...
    }
}
```

## 23. @RestControllerAdvice
- **功能简述**：组合了@ControllerAdvice和@ResponseBody，用于全局异常处理，捕获所有Controller抛出的异常，统一处理返回JSON。
- **本项目应用举例**：
  - **应用场景**：用在GlobalExceptionHandler上，统一处理所有Controller抛出的异常，返回友好的错误提示。
  - **源码逻辑简述**：Spring捕获Controller抛出的异常后，会交给@RestControllerAdvice类中带@ExceptionHandler的方法处理，本项目对不同异常分类处理，统一封装为Result错误格式返回前端。
- **代码示例**：
```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler
    public Result handleException(Exception e){
        log.error("程序出错了 ",e);
        return Result.error("程序异常");
    }
}
```

## 24. @ExceptionHandler
- **功能简述**：指定处理哪种类型的异常，方法会处理该类型及其子类异常。
- **本项目应用举例**：
  - **应用场景**：在GlobalExceptionHandler中使用，分别处理Exception、DuplicateKeyException、BusinessException，不同异常返回不同错误提示。
  - **源码逻辑简述**：当Controller抛出指定类型的异常时，对应的@ExceptionHandler方法会被调用，本项目中唯一键冲突异常会提取出重复值信息返回，业务异常直接返回错误消息，其它异常返回通用"程序异常"。
- **代码示例**：
```java
@ExceptionHandler(BusinessException.class)
public Result handleBusinessException(BusinessException e){
    log.error("服务器异常: ", e);
    return Result.error(e.getMessage());
}
```

## 25. @Service
- **功能简述**：Spring业务逻辑层组件注解，标识这是Service层Bean，会被组件扫描注册到IOC容器。
- **本项目应用举例**：
  - **应用场景**：所有Service实现类都用@Service，如DeptServiceImpl、EmpServiceImpl等，Controller注入Service调用业务逻辑。
  - **源码逻辑简述**：本质和@Component一样，语义更清晰，标识这是业务逻辑层组件，分工更明确。Service层调用Mapper层完成业务处理，事务管理也加在Service层。
- **代码示例**：
```java
@Service
public class DeptServiceImpl implements DeptService {
    @Autowired
    private DeptMapper deptMapper;
}
```

## 26. @Transactional
- **功能简述**：Spring声明式事务注解，开启事务管理，指定方法执行出现异常时自动回滚事务。
- **本项目应用举例**：
  - **应用场景**：用在需要事务保护的Service方法上，如新增员工同时插入员工表和工作经历表，删除员工同时删除两张表，必须保证原子性，要么都成功要么都失败。
  - **源码逻辑简述**：方法进入时Spring开启事务，方法执行完毕如果抛出异常（指定rollbackFor范围内）自动回滚，没有异常提交事务。本项目设置`rollbackFor = Exception.class`表示所有异常都回滚，包括非运行时异常。
- **代码示例**：
```java
@Transactional(rollbackFor = {Exception.class})
@Override
public void save(Emp emp){
    emp.setCreateTime(LocalDateTime.now());
    emp.setUpdateTime(LocalDateTime.now());
    empMapper.insert(emp);
    List<EmpExpr> exprList = emp.getExprList();
    if(!CollectionUtils.isEmpty(exprList)){
        exprList.forEach(expr -> expr.setEmpId(emp.getId()));
        empExprMapper.insertBatch(exprList);
    }
}
```

## 27. Propagation (事务传播机制)
- **功能简述**：配合@Transactional使用，指定事务传播行为，即多个带事务方法互相调用时事务如何传播。
- **本项目应用举例**：
  - **应用场景**：在EmpLogServiceImpl.insertLog方法上使用`propagation = Propagation.REQUIRES_NEW`，表示无论调用方是否有事务，该方法都必须开启一个新事务，新事务独立于原有事务。
  - **源码逻辑简述**：insertLog不管外层事务是否成功，日志都要记录成功，不能因为外层事务回滚导致日志也回滚不记录。REQUIRES_NEW挂起原有事务，开启新事务执行，执行完恢复原有事务。
- **代码示例**：
```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
@Override
public void insertLog(EmpLog empLog) {
    empLogMapper.insert(empLog);
}
```

## 28. @Mapper
- **功能简述**：MyBatis注解，标识这是MyBatis的Mapper接口，MyBatis自动生成该接口的代理实现类，注册到Spring容器。
- **本项目应用举例**：
  - **应用场景**：所有MyBatis Mapper接口都加@Mapper，如DeptMapper、EmpMapper，Service注入Mapper调用数据库操作。
  - **源码逻辑简述**：MyBatis启动扫描所有@Mapper接口，动态生成代理对象，处理SQL执行和结果映射，把代理对象交给Spring管理，Service就能直接注入使用。
- **代码示例**：
```java
@Mapper
public interface DeptMapper {
    @Select("select id, name, create_time, update_time from dept order by update_time desc;")
    List<Dept> findAll();
}
```

## 29. @Select
- **功能简述**：MyBatis注解，标注查询SQL，直接在注解上写SELECT语句，不需要XML映射文件。
- **本项目应用举例**：
  - **应用场景**：简单查询直接使用@Select写SQL，复杂查询使用XML，本项目DeptMapper简单查询都用注解方式。
  - **源码逻辑简述**：MyBatis执行方法时提取注解中的SQL，执行查询，自动将结果映射到返回值类型。对于单表简单查询，注解比XML更简洁。
- **代码示例**：
```java
@Select("select id, name, create_time, update_time from dept where id = #{id}")
Dept getById(Integer id);
```

## 30. @Insert
- **功能简述**：MyBatis注解，标注插入SQL，直接在注解上写INSERT语句。
- **本项目应用举例**：
  - **应用场景**：简单插入操作使用@Insert写SQL，如新增部门、插入操作日志等。
  - **源码逻辑简述**：MyBatis解析参数，执行INSERT语句，返回影响行数。配合@Options可以配置主键回写。
- **代码示例**：
```java
@Insert("insert into dept(name, create_time, update_time) values(#{name}, #{createTime}, #{updateTime});")
void insert(Dept dept);
```

## 31. @Delete
- **功能简述**：MyBatis注解，标注删除SQL，直接在注解上写DELETE语句。
- **本项目应用举例**：
  - **应用场景**：简单删除操作使用@Delete写SQL。
  - **源码逻辑简述**：MyBatis执行DELETE语句，返回影响行数。
- **代码示例**：
```java
@Delete("delete from dept where id = #{id};")
void deleteById(Integer id);
```

## 32. @Update (MyBatis)
- **功能简述**：MyBatis注解，标注更新SQL，直接在注解上写UPDATE语句。
- **本项目应用举例**：
  - **应用场景**：简单更新操作使用@Update写SQL。
  - **源码逻辑简述**：MyBatis执行UPDATE语句，返回影响行数。
- **代码示例**：
```java
@Update("update dept set name = #{name}, update_time = #{updateTime} where id = #{id}")
void update(Dept dept);
```

## 33. @Options
- **功能简述**：MyBatis注解，配置映射选项，支持配置主键生成、超时等。
- **本项目应用举例**：
  - **应用场景**：在EmpMapper.insert上使用`useGeneratedKeys = true, keyProperty = "id"`，配置主键回写，插入数据后自动把数据库生成的自增主键回写到Emp对象的id属性。
  - **源码逻辑简述**：插入成功后MyBatis从数据库获取生成的自增主键，赋值给keyProperty指定的属性。因为插入员工后需要用到员工id插入工作经历列表，所以必须回写主键。
- **代码示例**：
```java
@Options(useGeneratedKeys = true, keyProperty = "id")
@Insert("insert into emp(username, name, gender, phone, job, salary, image, entry_date, dept_id, create_time, update_time)" +
        "values (#{username},#{name},#{gender},#{phone},#{job},#{salary},#{image},#{entryDate},#{deptId},#{createTime},#{updateTime})")
void insert(Emp emp);
```

## 34. @MapKey
- **功能简述**：MyBatis注解，指定将查询结果的哪一列作为Map的key，封装为Map返回。
- **本项目应用举例**：
  - **应用场景**：在统计查询方法上使用，将统计结果按指定列分组封装。
  - **源码逻辑简述**：MyBatis查询结果转换后，以@MapKey指定字段的值作为key封装成Map，方便后续处理。本项目统计职位人数和性别人数都使用了。
- **代码示例**：
```java
@MapKey("pos")
List<Map<String,Object>> countEmpJobData();

@MapKey("name")
List<Map<String, Object>> countEmpGenderData();
```

## 35. @Data
- **功能简述**：Lombok注解，自动生成getter、setter、toString、equals、hashCode方法。
- **本项目应用举例**：
  - **应用场景**：所有POJO类、实体类、配置属性类都使用@Data，如Result、Emp、AliyunOSSProperties等，消除样板代码。
  - **源码逻辑简述**：编译阶段Lombok自动为类生成所有字段的getter、setter等方法，开发者不需要手动写，代码更简洁，修改字段属性不需要修改这些方法。
- **代码示例**：
```java
@Data
public class Result {
    private Integer code;
    private String msg;
    private Object data;
}
```

## 36. @NoArgsConstructor
- **功能简述**：Lombok注解，自动生成无参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要无参构造器的实体类上使用，如PageResult、Student、Clazz，框架反射创建对象需要无参构造器。
  - **源码逻辑简述**：当类中已经有全参构造器时，Java不会默认生成无参构造器，所以需要显式加@NoArgsConstructor生成，配合@AllArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 37. @AllArgsConstructor
- **功能简述**：Lombok注解，自动生成全参数构造器。
- **本项目应用举例**：
  - **应用场景**：在需要全参构造的实体类上使用，如PageResult，创建对象时可以一次性给所有属性赋值。
  - **源码逻辑简述**：Lombok编译生成包含所有字段的构造器，方便通过构造器注入属性值，配合@NoArgsConstructor一起使用。
- **代码示例**：
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult <T>{
    private Long total;
    private List<T> rows;
}
```

## 38. @Value (Spring)
- **功能简述**：Spring注解，从配置文件中注入单个配置属性值到字段。
- **本项目应用举例**：
  - **应用场景**：AliyunOSSOperator注释代码中使用@Value注入OSS配置，注释掉的代码演示了@Value用法，实际项目改用@ConfigurationProperties。
  - **源码逻辑简述**：Spring启动时解析${}占位符，从application.yml中取出对应配置赋值给字段。适合单个少量配置属性注入。
- **代码示例**：
```java
@Value("${aliyun.oss.endpoint}")
private String endpoint;
```

## 39. @ConfigurationProperties
- **功能简述**：Spring Boot注解，批量注入配置文件中前缀匹配的属性到JavaBean，类型安全的配置绑定。
- **本项目应用举例**：
  - **应用场景**：在AliyunOSSProperties上使用，prefix = "aliyun.oss"，将配置文件中所有以aliyun.oss开头的配置绑定到对应的字段。
  - **源码逻辑简述**：Spring Boot自动配置根据前缀匹配，将配置文件中的值按照字段名映射注入，比多个@Value更整洁，支持批量绑定，IDE也能自动提示。
- **代码示例**：
```java
@Data
@Component
@ConfigurationProperties(prefix = "aliyun.oss")
public class AliyunOSSProperties {
    private String endpoint;
    private String bucketName;
    private String region;
}
```

## 40. @Import
- **功能简述**：Spring注解，手动导入指定的类到Spring容器，一般用在注解上导入配置类。
- **本项目应用举例**：
  - **应用场景**：在自定义注解@EnableHeaderConfig上使用@Import导入MyImportSelector，实现按需导入配置。
  - **源码逻辑简述**：@Import导入MyImportSelector，MyImportSelector实现ImportSelector接口返回需要导入的配置类全限定名，Spring注册这些配置类到容器，实现模块化装配。这个例子演示了如何开发一个需要开启注解才能使用的功能模块。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

## 41. @Bean
- **功能简述**：Spring注解，用在@Configuration类中，声明方法返回值是一个Bean，交给Spring容器管理。
- **本项目应用举例**：
  - **应用场景**：SpringbootWebConfigApplication中使用@Bean方法注册AliyunOSSOperator，接收参数注入AliyunOSSProperties。也在HeaderConfig中注册HeaderParser和HeaderGenerator。
  - **源码逻辑简述**：调用方法获取返回值，将返回值注册为Bean存入IOC容器，方法参数自动从容器注入依赖。适合把第三方类实例化为Bean交给Spring管理，本项目演示了这种用法。
- **代码示例**：
```java
@Bean
public AliyunOSSOperator aliyunOSSOperator(AliyunOSSProperties aliyunOSSProperties){
    return new AliyunOSSOperator(aliyunOSSProperties);
}
```

## 42. @Scope
- **功能简述**：Spring注解，指定Bean的作用域（单例、多例等）。
- **本项目应用举例**：
  - **应用场景**：在DeptController中使用`@Scope("prototype")`，演示多例模式，每次请求创建新的Controller实例。
  - **源码逻辑简述**：默认是singleton单例，全局只有一个实例；prototype多例，每次获取Bean都创建新实例。这个示例演示了作用域的用法，实际项目Controller一般都是单例。
- **代码示例**：
```java
@Scope("prototype")
@RestController
public class DeptController {
    @Autowired
    private DeptService deptService;
}
```

## 43. @SpringBootTest
- **功能简述**：Spring Boot测试注解，标识这是一个Spring Boot单元测试类，会启动Spring容器。
- **本项目应用举例**：
  - **应用场景**：用在测试类上，整合Spring进行单元测试，可以注入容器中的Bean进行测试。
  - **源码逻辑简述**：JUnit测试启动时加载Spring Boot应用上下文，创建Spring容器，测试方法可以使用@Autowired注入Bean测试功能。本项目测试类使用了该注解。
- **代码示例**：
```java
@SpringBootTest
class SpringbootWebTests {
    @Autowired
    private DeptService deptService;
}
```

## 44. @Test
- **功能简述**：JUnit测试注解，标识这是一个测试方法，可以被JUnit运行器执行。
- **本项目应用举例**：
  - **应用场景**：测试类中的每个测试方法都加@Test，单元测试单独功能。
  - **源码逻辑简述**：JUnit执行测试时运行所有带@Test的方法，断言结果，输出测试报告。本项目演示了单元测试的写法。
- **代码示例**：
```java
@Test
void contextLoads() {
}
```

## 45. @EnableHeaderConfig (自定义)
- **功能简述**：本项目自定义开启注解，用于开启Header相关功能配置，演示基于注解的模块装配。
- **本项目应用举例**：
  - **应用场景**：在itheima-utils模块中定义，用户只需要在启动类上加上这个注解就能自动导入Header相关配置，不需要手动配置多个Bean。这是Spring Boot自动配置的雏形。
  - **源码逻辑简述**：该注解用@Import导入MyImportSelector，MyImportSelector返回HeaderConfig的全类名，Spring注册HeaderConfig，HeaderConfig定义了HeaderParser和HeaderGenerator两个Bean，实现一键开启功能。
- **代码示例**：
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MyImportSelector.class)
public @interface EnableHeaderConfig {
}
```

---

# 二、本项目中未用到但常用的注解

## 1. @Controller
- **功能简述**：Spring控制器注解，标识这是MVC模式的Controller，配合视图解析器返回视图页面，如果要返回JSON需要方法或类上加@ResponseBody。前后端不分离项目常用，本项目前后端分离用@RestController替代。

## 2. @ResponseBody
- **功能简述**：将方法返回值直接写入HTTP响应体，一般返回JSON格式数据。在@RestController出现之前，通常@Controller搭配@ResponseBody使用。

## 3. @Qualifier
- **功能简述**：配合@Autowired使用，当同一个接口有多个实现类时，通过@Qualifier指定按名称注入，解决同类型多个Bean的歧义问题。@Autowired默认按类型匹配，找不到唯一匹配时需要@Qualifier指定名称。

## 4. @Resource
- **功能简述**：Java JSR-250规范提供的依赖注入注解，默认按名称匹配，找不到再按类型匹配，是Spring支持的另一种依赖注入方式，和@Autowired功能类似但匹配规则不同。

## 5. @ComponentScan
- **功能简述**：指定Spring组件扫描的包路径，@SpringBootApplication已经包含了这个注解，默认扫描启动类当前包及其子包。需要自定义扫描范围时使用。

## 6. @ConfigurationPropertiesScan
- **功能简述**：Spring Boot注解，指定扫描哪些包下的@ConfigurationProperties配置类，自动注册到容器。开启对@ConfigurationProperties的扫描支持。

## 7. @EnableAutoConfiguration
- **功能简述**：Spring Boot自动配置注解，告诉Spring Boot根据类路径下的依赖自动配置项目，比如引入了spring-boot-starter-web就自动配置Tomcat和Spring MVC。@SpringBootApplication已经包含了这个注解。

## 8. @Conditional
- **功能简述**：Spring条件注解，满足条件才注册Bean到容器，Spring Boot自动配置大量使用这个注解，根据条件决定是否配置。派生注解有@ConditionalOnClass、@ConditionalOnProperty、@ConditionalOnMissingBean等。

## 9. @Lazy
- **功能简述**：开启懒加载，Bean不在容器启动时创建，第一次使用时才创建，加快项目启动速度，节省内存。适合不常用的Bean。本项目代码注释中有示例，但实际未启用。

## 10. @Primary
- **功能简述**：当同一个接口有多个实现Bean时，指定哪个是主要候选者，自动注入时优先选择这个Bean，解决歧义问题，比@Qualifier更简洁。

## 11. @SessionAttributes
- **功能简述**：将模型中的属性存储到Session域，用于在多个请求之间共享数据，传统MVC开发中使用，前后端分离项目很少用。

## 12. @CookieValue
- **功能简述**：绑定Cookie中的值到方法参数，获取指定Cookie的值，需要读取Cookie信息时使用。

## 13. @RequestHeader
- **功能简述**：绑定请求头到方法参数，获取指定请求头的值，需要读取请求头信息时使用，比如获取User-Agent、Authorization等。

## 14. @CrossOrigin
- **功能简述**：开启跨域支持，标注在Controller或方法上，允许跨域请求。Spring MVC会自动处理跨域预检请求，设置正确的CORS响应头。项目一般通过全局CORS配置或网关处理跨域，局部也可以用这个注解。

## 15. @Repository
- **功能简述**：Spring持久层组件注解，作用和@Component类似，语义更清晰，标识这是DAO/Mapper层组件。现在MyBatis项目一般用@Mapper，比@Repository更方便。

## 16. @Param
- **功能简述**：MyBatis注解，为Mapper接口方法参数指定名称，映射到SQL中的#{name}占位符，多个参数时必须加@Param指定名称。如果接口只有一个简单参数可以省略。

## 17. @Results / @Result
- **功能简述**：MyBatis注解，配置自定义结果映射，映射查询结果列到Java对象属性，解决列名和属性名不匹配的问题，复杂结果映射可以使用这个注解，一般简单查询不需要。

## 18. @OneToMany / @ManyToOne / @OneToOne
- **功能简述**：JPA/Hibernate关联注解，配置实体之间的关联关系，一对多、多对一、一对一关联。MyBatis项目一般不需要这些注解，JPA项目大量使用。

## 19. @Entity
- **功能简述**：JPA注解，标识这是一个实体类，对应数据库表，JPA项目每个实体类需要加这个注解。

## 20. @Id / @GeneratedValue
- **功能简述**：JPA注解，@Id标识主键字段，@GeneratedValue指定主键生成策略（自增、序列、UUID等）。

## 21. @Override
- **功能简述**：Java元注解，标识方法重写父接口/父类的方法，编译器会检查是否正确重写，这是一个标记注解，不影响运行，只是帮助编译器检查，好的编码习惯都会加上。

## 22. @Deprecated
- **功能简述**：Java元注解，标识方法、类、字段已过时，不推荐使用，编译器会发出警告，一般有更好的替代方案。

## 23. @SuppressWarnings
- **功能简述**：Java元注解，抑制编译器指定类型的警告，告诉编译器这里不需要警告，代码是故意这么写的。

## 24. @NonNull / @Nullable
- **功能简述**：JetBrains/Java注解，标记参数或返回值是否可以为null，IDE会给出空指针警告，静态代码检查帮助提前发现空指针问题。

## 25. @Valid / @Validated
- **功能简述**：Spring参数校验注解，开启JSR-303数据校验，对方法参数进行校验，配合@NotNull、@Min、@Max等约束注解使用，不满足约束时抛出BindException。接口入参校验常用。

## 26. @NotNull / @NotEmpty / @NotBlank
- **功能简述**：Bean Validation约束注解，校验参数不为null、不为空字符串、不为空白，数据校验常用，配合@Valid使用。

## 27. @Async
- **功能简述**：Spring异步方法注解，标注方法会在异步线程中执行，不阻塞主线程，需要在配置类上加@EnableAsync开启异步支持。适合发邮件、记录日志等不需要同步等待的操作。

## 28. @Scheduled
- **功能简述**：Spring定时任务注解，指定方法定时执行，支持cron表达式、固定延迟、固定频率，需要在配置类上加@EnableScheduling开启定时任务。项目定时任务使用。

## 29. @ControllerAdvice
- **功能简述**：Spring全局增强注解，可以用于全局异常处理、全局数据绑定、全局数据预处理，配合@ExceptionHandler做全局异常处理，本项目用@RestControllerAdvice（组合了@ControllerAdvice+@ResponseBody）。

## 30. @PostConstruct
- **功能简述**：Java注解，标记方法在Bean构造完成、依赖注入完成后执行，做一些初始化工作，在Bean生命周期中执行一次。

## 31. @PreDestroy
- **功能简述**：Java注解，标记方法在Bean销毁前执行，做一些清理工作，释放资源。

## 32. @Cacheable / @CacheEvict / @CachePut
- **功能简述**：Spring缓存注解，@Cacheable将方法返回值缓存，下次相同参数直接从缓存取；@CacheEvict清理缓存；@CachePut更新缓存。需要开启缓存后使用，提升查询性能减轻数据库压力。

## 33. @FeignClient
- **功能简述**：Spring Cloud OpenFeign注解，声明这是一个HTTP客户端接口，OpenFeign自动生成实现，调用其他微服务接口。微服务项目常用。

## 34. @PatchMapping
- **功能简述**：快捷注解，对应PATCH请求方法，RESTful风格常用于部分更新，本项目使用PUT做全量更新，没有用到PATCH。

## 35. @Order
- **功能简述**：Spring注解，指定Bean的排序，值越小优先级越高，多个拦截器、过滤器排序时使用，控制执行顺序。

## 36. @PropertySource
- **功能简述**：Spring注解，指定加载额外的properties配置文件，引入外部配置文件。Spring Boot自动加载application.properties/yml，一般不需要，自定义配置文件时使用。

## 37. @ImportResource
- **功能简述**：Spring注解，导入Spring XML配置文件，兼容老项目的XML配置，现在全注解开发很少用。

## 38. @TransactionalEventListener
- **功能简述**：Spring事件监听注解，监听事务提交后事件，实现业务解耦，事务提交后再执行后续操作，比如发送通知、更新缓存等。

## 39. @EventListener
- **功能简述**：Spring事件监听注解，标注方法作为事件监听器，响应特定事件，实现发布-订阅模式，组件间解耦通信。

## 40. @Profile
- **功能简述**：Spring环境注解，指定Bean在某个环境配置下才生效，如dev、test、prod，用于多环境部署时切换不同实现。
# 项目技术栈总结

## 一、项目整体架构

本项目采用 **Spring Boot + MyBatis + MySQL** 的主流 Java Web 技术栈，基于 **三层架构**（Controller - Service - Mapper）构建 RESTful API，集成了 JWT 认证鉴权、AOP 操作日志、阿里云 OSS 文件存储、分页查询等通用功能模块，同时通过 **Maven 多模块** 管理项目依赖和模块复用。

---

## 二、项目模块划分

| 模块 | 说明 | Java 版本 | Spring Boot 版本 |
|------|------|-----------|-----------------|
| **tlias-web-management** | 核心业务模块：部门管理、员工管理、班级管理、学员管理、登录认证、文件上传、报表统计等 | Java 21 | 4.0.5 |
| **springboot-web-config** | 辅助模块：演示 Spring Boot 配置、Bean 注册、阿里云 OSS 集成、JWT 令牌、Hutool 工具类等 | Java 17 | 3.2.10 |
| **itheima-utils** | 公共工具模块：自定义注解 `@EnableHeaderConfig`、Header 解析/生成器、Token 解析器等，供其他模块复用 | Java 17 | 3.2.10（仅依赖） |

---

## 三、核心技术栈

### 1. 基础框架与 Web 层

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Spring Boot | 4.0.5 / 3.2.10 | 项目基础框架，自动配置、IoC 容器、组件扫描 |
| Spring MVC | 集成在 spring-boot-starter-web 中 | RESTful API 开发，接收和响应 HTTP 请求 |
| Spring Boot Starter Web | — | Web 开发起步依赖，内嵌 Tomcat 服务器 |
| Spring Boot Starter Test | — | 单元测试与集成测试支持 |
| Spring MVC Test | — | Web 层测试，模拟 MVC 请求与响应 |

**相关注解：** `@SpringBootApplication`、`@RestController`、`@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@RequestParam`、`@PathVariable`、`@RequestBody`、`@DateTimeFormat`、`@CrossOrigin`

### 2. 数据访问层

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| MyBatis | 4.0.1 / 3.0.3 | 持久层框架，ORM 映射，SQL 与 Java 代码解耦 |
| MyBatis Spring Boot Starter | 4.0.1 / 3.0.3 | MyBatis 与 Spring Boot 集成起步依赖 |
| MySQL Connector/J | 随 Spring Boot 版本 | MySQL 数据库连接驱动 |
| PageHelper | 2.1.0 / 1.4.7 | 物理分页插件，简化分页查询 |

**相关注解：** `@Mapper`、`@Select`、`@Insert`、`@Update`、`@Delete`、`@Options`、`@MapKey`

**XML 映射文件：** `EmpMapper.xml`、`StudentMapper.xml`、`ClazzMapper.xml`、`EmpExprMapper.xml`

### 3. 事务管理

| 技术/组件 | 用途说明 |
|-----------|----------|
| Spring Transaction (JdbcTransactionManager) | 声明式事务管理，保证数据库操作的原子性 |

**相关注解：** `@Transactional`

**应用场景：** 员工新增（同时插入员工基本信息和员工工作经历）、员工批量删除（删除员工信息和对应的经历信息）

### 4. AOP 面向切面编程

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Spring AOP (spring-boot-starter-aspectj) | — | 面向切面编程，实现横切关注点 |
| AspectJ Weaver | — | AOP 底层织入实现 |

**相关注解：** `@Aspect`、`@Around`、`@Pointcut`

**应用场景：** `OperationLogAspect` 切面类拦截所有标注 `@Log` 注解的方法，自动记录操作日志（操作人、操作时间、方法参数、返回值、执行耗时）到数据库。

### 5. 认证与安全

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| JJWT (io.jsonwebtoken) | 0.9.1 | JWT 令牌的生成和解析，实现无状态登录认证 |
| Servlet Filter | — | 通过 `TokenFilter` 拦截所有请求，校验 JWT 令牌有效性 |
| Spring Interceptor | — | 通过 `TokenInterceptor` 实现请求拦截（当前注释状态） |

**相关注解：** `@WebFilter`、`@ServletComponentScan`

**认证流程：**
1. 用户登录成功后，后端生成 JWT 令牌返回给前端
2. 前端后续请求在 Header 中携带 token
3. `TokenFilter` 拦截所有请求，放行登录接口，其他请求校验 token
4. 校验通过后将用户信息存入 `CurrentHolder`（ThreadLocal），校验失败返回 401

### 6. 文件存储

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| 阿里云 OSS SDK | 3.18.4 / 3.17.4 | 阿里云对象存储服务，用于文件上传 |
| JAXB API / Runtime | 2.3.x | 阿里云 OSS SDK 依赖的 XML 绑定库 |

**相关注解：** `@ConfigurationProperties`、`@Component`

**应用场景：** 上传员工头像、班级/学员相关图片等文件到阿里云 OSS，返回可访问的 URL。

### 7. 工具与增强库

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Lombok | 最新稳定版 | 通过注解简化 Java Bean 开发，减少 Getter/Setter/构造器/日志等模板代码 |
| Hutool | 5.8.27 |  Java 工具类库，提供字符串、集合、加密等便捷工具 |

**相关注解：** `@Data`、`@Slf4j`、`@NoArgsConstructor`、`@AllArgsConstructor`

### 8. 全局异常处理

| 组件 | 用途说明 |
|------|----------|
| `@RestControllerAdvice` + `@ExceptionHandler` | 统一处理全局异常，返回标准 JSON 响应格式 |

**处理策略：**
- 通用异常：`Exception` -> 返回 `Result.error("程序异常")`
- 唯一键冲突异常：`DuplicateKeyException` -> 返回具体字段已存在的提示
- 业务异常：`BusinessException`（自定义异常） -> 返回业务错误提示

### 9. 日志体系

| 组件 | 用途说明 |
|------|----------|
| Logback | Spring Boot 默认日志框架，通过 `logback.xml` 配置日志输出格式和策略 |
| SLF4J + Lombok @Slf4j | 日志门面，配合 Lombok 注解简化日志声明 |

---

## 四、架构设计模式

| 模式 | 说明 |
|------|------|
| **三层架构** | Controller（请求接收） -> Service（业务逻辑） -> Mapper（数据访问），职责清晰 |
| **RESTful API** | 使用标准的 HTTP 方法（GET/POST/PUT/DELETE）和资源路径设计接口 |
| **统一响应体** | 所有接口返回统一封装的 `Result` 对象（code + message + data） |
| **DTO/POJO 分离** | `EmpQueryParam` 等参数封装类用于请求参数传递，与数据库实体解耦 |
| **ThreadLocal 上下文** | `CurrentHolder` 基于 ThreadLocal 存储当前登录用户信息，线程安全 |
| **自定义注解 + AOP** | 自定义 `@Log` 注解标记需要日志记录的方法，通过 AOP 切面统一处理 |

---

## 五、数据库

| 数据库 | 版本 | 说明 |
|--------|------|------|
| MySQL | — | 关系型数据库，存储所有业务数据 |
| 数据库名 | tlias | 项目使用的数据库名称 |

**核心数据表：** dept（部门）、emp（员工）、emp_expr（员工工作经历）、clazz（班级）、student（学员）、operate_log（操作日志）

---

## 六、自定义注解与公共模块

### itheima-utils 模块提供的功能

| 组件 | 说明 |
|------|------|
| `@EnableHeaderConfig` | 自定义注解，通过 `@Import` 导入 HeaderConfig 配置类 |
| `HeaderConfig` | 配置类，注册 `HeaderParser`、`HeaderGenerator` 等 Bean |
| `TokenParser` | 令牌解析器工具类 |
| `MyImportSelector` | 动态导入选择器，配合 `@EnableHeaderConfig` 使用 |

### tlias-web-management 自定义注解

| 组件 | 说明 |
|------|------|
| `@Log` | 自定义注解，标记需要记录操作日志的方法，配合 `OperationLogAspect` AOP 切面使用 |
| `@EnableHeaderConfig` | 导入 itheima-utils 模块的配置功能 |

---

## 七、构建与运行

| 工具/环境 | 版本/说明 |
|-----------|----------|
| Maven | 项目构建和依赖管理工具 |
| JDK | Java 21（tlias-web-management）/ Java 17（其余模块） |
| 内嵌服务器 | Tomcat（Spring Boot 内嵌） |
| 项目打包 | `mvn package` 生成可执行 JAR |

# 项目技术栈总结

## 一、项目整体架构

本项目采用 **Spring Boot + MyBatis + MySQL** 的主流 Java Web 技术栈，基于 **三层架构**（Controller - Service - Mapper）构建 RESTful API，集成了 JWT 认证鉴权、AOP 操作日志、阿里云 OSS 文件存储、分页查询等通用功能模块，同时通过 **Maven 多模块** 管理项目依赖和模块复用。

---

## 二、项目模块划分

| 模块 | 说明 | Java 版本 | Spring Boot 版本 |
|------|------|-----------|-----------------|
| **tlias-web-management** | 核心业务模块：部门管理、员工管理、班级管理、学员管理、登录认证、文件上传、报表统计等 | Java 21 | 4.0.5 |
| **springboot-web-config** | 辅助模块：演示 Spring Boot 配置、Bean 注册、阿里云 OSS 集成、JWT 令牌、Hutool 工具类等 | Java 17 | 3.2.10 |
| **itheima-utils** | 公共工具模块：自定义注解 `@EnableHeaderConfig`、Header 解析/生成器、Token 解析器等，供其他模块复用 | Java 17 | 3.2.10（仅依赖） |

---

## 三、核心技术栈

### 1. 基础框架与 Web 层

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Spring Boot | 4.0.5 / 3.2.10 | 项目基础框架，自动配置、IoC 容器、组件扫描 |
| Spring MVC | 集成在 spring-boot-starter-web 中 | RESTful API 开发，接收和响应 HTTP 请求 |
| Spring Boot Starter Web | — | Web 开发起步依赖，内嵌 Tomcat 服务器 |
| Spring Boot Starter Test | — | 单元测试与集成测试支持 |
| Spring MVC Test | — | Web 层测试，模拟 MVC 请求与响应 |

**相关注解：** `@SpringBootApplication`、`@RestController`、`@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@RequestParam`、`@PathVariable`、`@RequestBody`、`@DateTimeFormat`、`@CrossOrigin`

### 2. 数据访问层

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| MyBatis | 4.0.1 / 3.0.3 | 持久层框架，ORM 映射，SQL 与 Java 代码解耦 |
| MyBatis Spring Boot Starter | 4.0.1 / 3.0.3 | MyBatis 与 Spring Boot 集成起步依赖 |
| MySQL Connector/J | 随 Spring Boot 版本 | MySQL 数据库连接驱动 |
| PageHelper | 2.1.0 / 1.4.7 | 物理分页插件，简化分页查询 |

**相关注解：** `@Mapper`、`@Select`、`@Insert`、`@Update`、`@Delete`、`@Options`、`@MapKey`

**XML 映射文件：** `EmpMapper.xml`、`StudentMapper.xml`、`ClazzMapper.xml`、`EmpExprMapper.xml`

### 3. 事务管理

| 技术/组件 | 用途说明 |
|-----------|----------|
| Spring Transaction (JdbcTransactionManager) | 声明式事务管理，保证数据库操作的原子性 |

**相关注解：** `@Transactional`

**应用场景：** 员工新增（同时插入员工基本信息和员工工作经历）、员工批量删除（删除员工信息和对应的经历信息）

### 4. AOP 面向切面编程

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Spring AOP (spring-boot-starter-aspectj) | — | 面向切面编程，实现横切关注点 |
| AspectJ Weaver | — | AOP 底层织入实现 |

**相关注解：** `@Aspect`、`@Around`、`@Pointcut`

**应用场景：** `OperationLogAspect` 切面类拦截所有标注 `@Log` 注解的方法，自动记录操作日志（操作人、操作时间、方法参数、返回值、执行耗时）到数据库。

### 5. 认证与安全

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| JJWT (io.jsonwebtoken) | 0.9.1 | JWT 令牌的生成和解析，实现无状态登录认证 |
| Servlet Filter | — | 通过 `TokenFilter` 拦截所有请求，校验 JWT 令牌有效性 |
| Spring Interceptor | — | 通过 `TokenInterceptor` 实现请求拦截（当前注释状态） |

**相关注解：** `@WebFilter`、`@ServletComponentScan`

**认证流程：**
1. 用户登录成功后，后端生成 JWT 令牌返回给前端
2. 前端后续请求在 Header 中携带 token
3. `TokenFilter` 拦截所有请求，放行登录接口，其他请求校验 token
4. 校验通过后将用户信息存入 `CurrentHolder`（ThreadLocal），校验失败返回 401

### 6. 文件存储

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| 阿里云 OSS SDK | 3.18.4 / 3.17.4 | 阿里云对象存储服务，用于文件上传 |
| JAXB API / Runtime | 2.3.x | 阿里云 OSS SDK 依赖的 XML 绑定库 |

**相关注解：** `@ConfigurationProperties`、`@Component`

**应用场景：** 上传员工头像、班级/学员相关图片等文件到阿里云 OSS，返回可访问的 URL。

### 7. 工具与增强库

| 技术/组件 | 版本 | 用途说明 |
|-----------|------|----------|
| Lombok | 最新稳定版 | 通过注解简化 Java Bean 开发，减少 Getter/Setter/构造器/日志等模板代码 |
| Hutool | 5.8.27 |  Java 工具类库，提供字符串、集合、加密等便捷工具 |

**相关注解：** `@Data`、`@Slf4j`、`@NoArgsConstructor`、`@AllArgsConstructor`

### 8. 全局异常处理

| 组件 | 用途说明 |
|------|----------|
| `@RestControllerAdvice` + `@ExceptionHandler` | 统一处理全局异常，返回标准 JSON 响应格式 |

**处理策略：**
- 通用异常：`Exception` -> 返回 `Result.error("程序异常")`
- 唯一键冲突异常：`DuplicateKeyException` -> 返回具体字段已存在的提示
- 业务异常：`BusinessException`（自定义异常） -> 返回业务错误提示

### 9. 日志体系

| 组件 | 用途说明 |
|------|----------|
| Logback | Spring Boot 默认日志框架，通过 `logback.xml` 配置日志输出格式和策略 |
| SLF4J + Lombok @Slf4j | 日志门面，配合 Lombok 注解简化日志声明 |

---

## 四、架构设计模式

| 模式 | 说明 |
|------|------|
| **三层架构** | Controller（请求接收） -> Service（业务逻辑） -> Mapper（数据访问），职责清晰 |
| **RESTful API** | 使用标准的 HTTP 方法（GET/POST/PUT/DELETE）和资源路径设计接口 |
| **统一响应体** | 所有接口返回统一封装的 `Result` 对象（code + message + data） |
| **DTO/POJO 分离** | `EmpQueryParam` 等参数封装类用于请求参数传递，与数据库实体解耦 |
| **ThreadLocal 上下文** | `CurrentHolder` 基于 ThreadLocal 存储当前登录用户信息，线程安全 |
| **自定义注解 + AOP** | 自定义 `@Log` 注解标记需要日志记录的方法，通过 AOP 切面统一处理 |

---

## 五、数据库

| 数据库 | 版本 | 说明 |
|--------|------|------|
| MySQL | — | 关系型数据库，存储所有业务数据 |
| 数据库名 | tlias | 项目使用的数据库名称 |

**核心数据表：** dept（部门）、emp（员工）、emp_expr（员工工作经历）、clazz（班级）、student（学员）、operate_log（操作日志）

---

## 六、自定义注解与公共模块

### itheima-utils 模块提供的功能

| 组件 | 说明 |
|------|------|
| `@EnableHeaderConfig` | 自定义注解，通过 `@Import` 导入 HeaderConfig 配置类 |
| `HeaderConfig` | 配置类，注册 `HeaderParser`、`HeaderGenerator` 等 Bean |
| `TokenParser` | 令牌解析器工具类 |
| `MyImportSelector` | 动态导入选择器，配合 `@EnableHeaderConfig` 使用 |

### tlias-web-management 自定义注解

| 组件 | 说明 |
|------|------|
| `@Log` | 自定义注解，标记需要记录操作日志的方法，配合 `OperationLogAspect` AOP 切面使用 |
| `@EnableHeaderConfig` | 导入 itheima-utils 模块的配置功能 |

---

## 七、构建与运行

| 工具/环境 | 版本/说明 |
|-----------|----------|
| Maven | 项目构建和依赖管理工具 |
| JDK | Java 21（tlias-web-management）/ Java 17（其余模块） |
| 内嵌服务器 | Tomcat（Spring Boot 内嵌） |
| 项目打包 | `mvn package` 生成可执行 JAR |
