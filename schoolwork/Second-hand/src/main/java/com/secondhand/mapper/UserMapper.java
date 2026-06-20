package com.secondhand.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.secondhand.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    @Select("SELECT * FROM user WHERE username = #{username}")
    User selectByUsername(@Param("username") String username);

    @Select("SELECT * FROM user WHERE token = #{token}")
    User selectByToken(@Param("token") String token);

    /** 管理员概览：用户总数（不含 admin） */
    @Select("SELECT COUNT(*) FROM user WHERE role != 'admin'")
    int countAll();

    /** 管理员概览：上架过商品的商户数 */
    @Select("SELECT COUNT(DISTINCT user_id) FROM product")
    int countMerchants();

    /** 管理员概览：7日内新增用户 */
    @Select("SELECT COUNT(*) FROM user WHERE role != 'admin' AND create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
    int countRecent7Days();

    /** 管理员概览：当日新增用户 */
    @Select("SELECT COUNT(*) FROM user WHERE role != 'admin' AND create_time >= CURDATE()")
    int countToday();
}
