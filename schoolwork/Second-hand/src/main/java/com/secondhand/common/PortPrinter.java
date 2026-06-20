package com.secondhand.common;

import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import java.net.InetAddress;

/**
 * 启动后打印实际端口（server.port=0 时自动分配）
 */
@Component
public class PortPrinter implements ApplicationListener<WebServerInitializedEvent> {

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        int port = event.getWebServer().getPort();
        System.out.println("========================================");
        System.out.println("  前端页面:  http://localhost:" + port);
        System.out.println("  API 文档:  http://localhost:" + port + "/doc.html");
        System.out.println("========================================");
    }
}
