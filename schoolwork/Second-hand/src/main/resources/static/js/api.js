/**
 * API 通信层
 * 封装所有后端接口调用
 */
const API = (() => {
    // 通过 nginx 同源代理，无需指定端口
    const BASE_URL = '';

    /** 通用请求方法 */
    async function request(method, path, body = null, needToken = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (needToken) {
            const token = AppState.getToken();
            if (token) headers['token'] = token;
        }
        const config = { method, headers };
        if (body && method !== 'GET') {
            config.body = JSON.stringify(body);
        }

        const res = await fetch(`${BASE_URL}${path}`, config);
        const data = await res.json();

        if (data.code !== 200) {
            throw new Error(data.message || '请求失败');
        }
        return data;
    }

    function get(path, needToken = false) {
        return request('GET', path, null, needToken);
    }

    function post(path, body, needToken = false) {
        return request('POST', path, body, needToken);
    }

    function put(path, body, needToken = false) {
        return request('PUT', path, body, needToken);
    }

    function del(path, body = null, needToken = false) {
        return request('DELETE', path, body, needToken);
    }

    /** 上传文件（使用 FormData，不设 Content-Type 让浏览器自动处理） */
    async function uploadFile(path, file, needToken = false) {
        const formData = new FormData();
        formData.append('file', file);
        const headers = {};
        if (needToken) {
            const token = AppState.getToken();
            if (token) headers['token'] = token;
        }
        const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
        const data = await res.json();
        if (data.code !== 200) {
            throw new Error(data.message || '上传失败');
        }
        return data;
    }

    // ==================== 用户接口 ====================
    const User = {
        register: (username, password, phone) =>
            post('/api/user/register', { username, password, phone }),
        login: (username, password) =>
            post('/api/user/login', { username, password }),
        me: () => get('/api/user/me', true),
        updateProfile: (nickname, phone, avatar) =>
            put('/api/user/profile', { nickname, phone, avatar }, true),
        updatePassword: (oldPassword, newPassword) =>
            put('/api/user/password', { oldPassword, newPassword }, true),
        list: () => get('/api/admin/user/list', true),
        getById: (id) => get(`/api/admin/user/${id}`, true),
        update: (id, data) => put(`/api/admin/user/${id}`, data, true),
        disable: (id) => del(`/api/admin/user/${id}`, null, true),
        batchUpdateStatus: (ids, status) => put('/api/admin/user/batch/status', { ids, status }, true),
        deletePermanently: (id) => del(`/api/admin/user/${id}/permanent`, null, true),
        batchDelete: (ids) => del('/api/admin/user/batch', { ids }, true),
    };

    // ==================== 商品接口 ====================
    const Product = {
        list: (name, categoryId, minPrice, maxPrice, sortBy, page, size) => {
            const params = new URLSearchParams();
            if (name) params.append('name', name);
            if (categoryId) params.append('categoryId', categoryId);
            if (minPrice) params.append('minPrice', minPrice);
            if (maxPrice) params.append('maxPrice', maxPrice);
            if (sortBy) params.append('sortBy', sortBy);
            if (page) params.append('page', page);
            if (size) params.append('size', size);
            const qs = params.toString();
            return get(`/api/product/list${qs ? '?' + qs : ''}`);
        },
        getById: (id) => get(`/api/product/${id}`),
        sellerProducts: (userId, page, size) => {
            const params = new URLSearchParams();
            if (page) params.append('page', page);
            if (size) params.append('size', size);
            const qs = params.toString();
            return get(`/api/product/seller/${userId}${qs ? '?' + qs : ''}`);
        },
        // 用户端发布/编辑
        publish: (data) => post('/api/product', data, true),
        updateMine: (id, data) => put(`/api/product/${id}`, data, true),
        deleteMine: (id) => del(`/api/product/${id}`, null, true),
        toggleStatus: (id) => put(`/api/product/${id}/status`, null, true),
        myList: (status, page, size) => {
            const params = new URLSearchParams();
            if (status != null) params.append('status', status);
            if (page) params.append('page', page);
            if (size) params.append('size', size);
            const qs = params.toString();
            return get(`/api/product/my-list${qs ? '?' + qs : ''}`, true);
        },
        // 管理员端
        add: (data) => post('/api/admin/product', data, true),
        update: (id, data) => put(`/api/admin/product/${id}`, data, true),
        delete: (id) => del(`/api/admin/product/${id}`, null, true),
        batchDelete: (ids) => del('/api/admin/product/batch', { ids }, true),
        batchUpdateStatus: (ids, status) => put('/api/admin/product/batch/status', { ids, status }, true),
        listingHistory: (id) => get(`/api/admin/product/${id}/listing-history`, true),
        // 概览
        sellerOverview: () => get('/api/product/overview', true),
        adminOverview: () => get('/api/admin/overview', true),
    };

    // ==================== 文件上传接口 ====================
    const Upload = {
        image: (file) => uploadFile('/api/upload/image', file, true),
        images: (files) => {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));
            const headers = {};
            const token = AppState.getToken();
            if (token) headers['token'] = token;
            return fetch('/api/upload/images', { method: 'POST', headers, body: formData }).then(r => r.json()).then(d => {
                if (d.code !== 200) throw new Error(d.message || '上传失败');
                return d;
            });
        },
    };

    // ==================== 购物车接口 ====================
    const Cart = {
        add: (productId, quantity) =>
            post('/api/cart/add', { productId, quantity }, true),
        list: () => get('/api/cart/list', true),
        updateQuantity: (id, quantity) =>
            put(`/api/cart/${id}`, { quantity }, true),
        remove: (id) => del(`/api/cart/${id}`, null, true),
    };

    // ==================== 分类接口 ====================
    const Category = {
        list: () => get('/api/category/list'),
        adminList: () => get('/api/admin/category/list', true),
        add: (data) => post('/api/admin/category', data, true),
        update: (id, data) => put(`/api/admin/category/${id}`, data, true),
        delete: (id) => del(`/api/admin/category/${id}`, null, true),
    };

    // ==================== 订单接口 ====================
    const Order = {
        submit: (data) => post('/api/order/submit', data, true),
        list: (status) => {
            const params = status != null ? `?status=${status}` : '';
            return get(`/api/order/list${params}`, true);
        },
        detail: (id) => get(`/api/order/${id}`, true),
        cancel: (id) => put(`/api/order/${id}/cancel`, null, true),
        pay: (id) => put(`/api/order/${id}/pay`, null, true),
        confirm: (id) => put(`/api/order/${id}/confirm`, null, true),
        sellerList: (status) => {
            const params = status != null ? `?status=${status}` : '';
            return get(`/api/seller/order/list${params}`, true);
        },
        ship: (id) => put(`/api/seller/order/${id}/ship`, null, true),
        adminList: (status) => {
            const params = status != null ? `?status=${status}` : '';
            return get(`/api/admin/order/list${params}`, true);
        },
        updateStatus: (id, status) => put(`/api/admin/order/${id}/status`, { status }, true),
        batchUpdateStatus: (ids, status) => put('/api/admin/order/batch/status', { ids, status }, true),
        delete: (id) => del(`/api/admin/order/${id}`, null, true),
        batchDelete: (ids) => del('/api/admin/order/batch', { ids }, true),
    };

    // ==================== 收藏接口 ====================
    const Favorite = {
        add: (productId) => post('/api/favorite/add', { productId }, true),
        remove: (productId) => del(`/api/favorite/remove/${productId}`, null, true),
        check: (productId) => get(`/api/favorite/check/${productId}`, true),
        list: () => get('/api/favorite/list', true),
    };

    return { User, Product, Upload, Cart, Category, Order, Favorite };
})();
