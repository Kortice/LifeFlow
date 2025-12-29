import network
import socket
import json
import time
from machine import Pin, Timer
import esp32s3.ssd1315 as ssd1315
from machine import I2C
import hashlib
import ubinascii

# OLED屏幕配置（ESP32-S3 GPIO18=SCL, GPIO17=SDA）
OLED_INITIALIZED = False
try:
    # 初始化I2C总线
    i2c = I2C(0, scl=Pin(18), sda=Pin(17), freq=400000)
    print("✅ I2C总线初始化成功")
    
    # 扫描I2C设备
    devices = i2c.scan()
    print(f"🔍 扫描到{len(devices)}个I2C设备")
    for addr in devices:
        print(f"   设备地址: 0x{addr:02X}")
    
    # 尝试使用默认地址0x3C初始化OLED
    OLED_ADDR = 0x3C
    if OLED_ADDR in devices:
        oled = ssd1315.SSD1315(128, 64, i2c, addr=OLED_ADDR)
        print("✅ OLED初始化成功")
        OLED_INITIALIZED = True
    else:
        print(f"❌ 未找到OLED设备（期望地址: 0x{OLED_ADDR:02X}）")
except Exception as e:
    print(f"❌ OLED初始化失败: {e}")

# 状态变量
current_state = "idle"  # idle, running, paused, completed, break_running, break_paused, break_completed
focus_duration = 0  # 总秒数（专注或休息）
remaining_seconds = 0
start_time = 0
is_paused = False
pause_remaining = 0
is_break = False  # 是否处于休息模式

# 初始化OLED
def init_display():
    if OLED_INITIALIZED:
        try:
            oled.fill(0)
            oled.text("专注时钟", 0, 0)
            oled.text("等待连接...", 0, 20)
            oled.show()
            print("✅ 初始化OLED显示")
        except Exception as e:
            print("❌ 初始化显示失败:", e)

# 显示倒计时
def display_timer():
    if OLED_INITIALIZED:
        try:
            print(f"🎨 显示计时器 - 状态: {current_state}, 剩余: {remaining_seconds}秒, 休息模式: {is_break}")
            oled.fill(0)
            
            # 显示状态
            status_text = "准备就绪"
            if current_state == "running":
                status_text = "专注中"
            elif current_state == "paused":
                status_text = "已暂停"
            elif current_state == "completed":
                status_text = "完成!"
            elif current_state == "break_running":
                status_text = "休息中"
            elif current_state == "break_paused":
                status_text = "休息暂停"
            elif current_state == "break_completed":
                status_text = "休息完成"
            
            oled.text(status_text, 0, 0)
            print(f"   状态文本: {status_text}")
            
            # 显示时间
            minutes = remaining_seconds // 60
            seconds = remaining_seconds % 60
            time_str = "{:02d}:{:02d}".format(minutes, seconds)
            
            # 显示时间
            oled.text(time_str, 20, 20)
            print(f"   时间显示: {time_str}")
            
            # 显示进度条
            if focus_duration > 0:
                progress = ((focus_duration - remaining_seconds) / focus_duration) * 100
                bar_width = int(progress * 128 / 100)  # 使用完整宽度128
                oled.fill_rect(0, 40, bar_width, 10, 1)  # 进度条位置
                oled.rect(0, 40, 128, 10, 1)  # 进度条边框
                
                # 显示百分比
                percent_str = "{:.0f}%".format(progress)
                oled.text(percent_str, 45, 55)
                print(f"   进度显示: {progress:.0f}% (宽度: {bar_width})")
            
            oled.show()
            print(f"✅ 显示更新完成")
        except Exception as e:
            print("❌ 显示计时器失败:", e)

# 更新计时器
def update_timer():
    global remaining_seconds
    
    try:
        # 处理专注状态倒计时
        if current_state == "running" and not is_paused:
            if remaining_seconds > 0:
                remaining_seconds -= 1
                display_timer()
                
                # 检查是否完成
                if remaining_seconds == 0:
                    complete_focus()
            else:
                complete_focus()
        # 处理休息状态倒计时
        elif current_state == "break_running" and not is_paused:
            if remaining_seconds > 0:
                remaining_seconds -= 1
                display_timer()
                
                # 检查休息是否完成
                if remaining_seconds == 0:
                    complete_break()
            else:
                complete_break()
    except Exception as e:
        print("更新计时器失败:", e)

# 开始专注
def start_focus(duration_minutes):
    global current_state, focus_duration, remaining_seconds, start_time, is_paused
    
    current_state = "running"
    focus_duration = duration_minutes * 60
    remaining_seconds = focus_duration
    start_time = time.time()
    is_paused = False
    
    display_timer()
    print("开始专注: {}分钟".format(duration_minutes))

# 暂停专注
def pause_focus():
    global is_paused, current_state, pause_remaining
    
    if current_state == "running":
        is_paused = True
        current_state = "paused"
        pause_remaining = remaining_seconds
        display_timer()
        print("已暂停")

# 继续专注
def resume_focus():
    global is_paused, current_state
    
    if current_state == "paused":
        is_paused = False
        current_state = "running"
        display_timer()
        print("继续专注")

# 停止专注/休息
def stop_focus():
    global current_state, remaining_seconds, is_paused, is_break
    
    current_state = "idle"
    remaining_seconds = 0
    is_paused = False
    is_break = False
    
    init_display()
    print("已停止计时器，回到初始状态")

# 延迟调用stop_focus函数
def delayed_stop_focus(timer):
    stop_focus()

# 完成专注
def complete_focus():
    global current_state
    
    current_state = "completed"
    print("🎉 专注完成")
    
    if OLED_INITIALIZED:
        try:
            oled.fill(0)
            oled.text("专注完成!", 10, 20)
            oled.text("恭喜你!", 30, 35)
            oled.text("休息一下吧", 15, 50)
            oled.show()
            print("✅ 显示完成信息")
        except Exception as e:
            print("❌ 完成状态显示失败:", e)
    
    # 使用Timer在5秒后调用stop_focus，避免阻塞执行
    try:
        # 创建一次性定时器，5秒后执行stop_focus
        complete_timer = Timer(-1)  # 使用虚拟定时器
        complete_timer.init(period=5000, mode=Timer.ONE_SHOT, callback=delayed_stop_focus)
        print("⏰ 已设置5秒后回到初始状态")
    except Exception as e:
        print("❌ 初始化完成定时器失败:", e)
        # 如果定时器创建失败，仍然调用stop_focus以确保状态正确
        stop_focus()

# 完成休息
def complete_break():
    global current_state, is_break
    
    current_state = "break_completed"
    is_break = False
    print("🎉 休息完成")
    
    if OLED_INITIALIZED:
        try:
            oled.fill(0)
            oled.text("休息完成!", 10, 20)
            oled.text("准备开始", 25, 35)
            oled.text("下一轮专注", 15, 50)
            oled.show()
            print("✅ 显示休息完成信息")
        except Exception as e:
            print("❌ 休息完成状态显示失败:", e)
    
    # 使用Timer在5秒后调用stop_focus，回到初始状态
    try:
        complete_timer = Timer(-1)  # 使用虚拟定时器
        complete_timer.init(period=5000, mode=Timer.ONE_SHOT, callback=delayed_stop_focus)
        print("⏰ 已设置5秒后回到初始状态")
    except Exception as e:
        print("❌ 初始化休息完成定时器失败:", e)
        stop_focus()

# WebSocket服务器
def start_websocket_server():
    # 创建AP热点（这样手机/电脑可以直接连接）
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid='LifeFlow-ESP32', password='12345678')  # 使用与前端配置一致的SSID
    ap.ifconfig(('192.168.4.1', '255.255.255.0', '192.168.4.1', '192.168.4.1'))  # 设置固定IP
    
    print("AP模式已启动")
    print("SSID: LifeFlow-ESP32")
    print("密码: 12345678")
    print("IP地址:", ap.ifconfig()[0])
    
    # 创建Socket服务器
    addr = socket.getaddrinfo('0.0.0.0', 80)[0][-1]
    server_socket = socket.socket()
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(addr)
    server_socket.listen(1)
    
    print("WebSocket服务器已启动，等待连接...")
    
    # 检查OLED是否已初始化成功
    if OLED_INITIALIZED:
        init_display()
    
    # 创建定时器用于更新显示
    try:
        timer = Timer(0)
        timer.init(period=1000, mode=Timer.PERIODIC, callback=lambda t: update_timer())
        print("✅ 定时器已初始化，周期1秒")
    except Exception as e:
        print("❌ 初始化定时器失败:", e)
    
    while True:
        try:
            client_socket, client_addr = server_socket.accept()
            print("客户端连接:", client_addr)
            
            # 处理WebSocket握手
            request = client_socket.recv(1024).decode()
            print("完整请求内容:", request)
            
            if "Upgrade: websocket" in request:
                # 提取WebSocket Key
                key_line = [line for line in request.split('\r\n') if 'Sec-WebSocket-Key:' in line][0]
                key = key_line.split(': ')[1].strip()
                
                # 计算响应
                magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
                combined = (key + magic).encode()
                sha1_hash = hashlib.sha1(combined).digest()
                
                # MicroPython中base64.b64encode可能不存在，使用ubinascii.b2a_base64替代
                accept_key = ubinascii.b2a_base64(sha1_hash).decode().strip()
                print(f"🔑 WebSocket Key: {key}")
                print(f"🔐 WebSocket Accept: {accept_key}")
                
                # 发送握手响应
                response = (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    "Sec-WebSocket-Accept: " + accept_key + "\r\n"
                    "Access-Control-Allow-Origin: *\r\n\r\n"
                )
                print("发送WebSocket握手响应:", response)
                client_socket.send(response.encode())
                
                print("WebSocket连接已建立")
                
                # 更新显示
                if OLED_INITIALIZED:
                    try:
                        oled.fill(0)
                        oled.text("已连接!", 20, 20)
                        oled.text("等待指令...", 5, 35)
                        oled.show()
                        print("✅ 更新OLED连接状态")
                    except Exception as e:
                        print("❌ 更新显示失败:", e)
                
                # 处理消息
                while True:
                    try:
                        data = client_socket.recv(1024)
                        if not data:
                            print("❌ 未收到数据，连接可能已关闭")
                            break
                            
                        print(f"🔍 收到原始WebSocket数据: {data}")
                        print(f"   数据长度: {len(data)}")
                        
                        # 简单的WebSocket消息解析
                        if len(data) > 2:
                            opcode = data[0] & 0x0F
                            if opcode == 8:  # 关闭帧
                                print("🔌 收到关闭帧，关闭连接")
                                break
                            
                            payload_len = data[1] & 127
                            print(f"   负载长度: {payload_len}")
                            
                            if payload_len == 126:
                                payload_len = (data[2] << 8) | data[3]
                                print(f"   扩展负载长度: {payload_len}")
                                mask = data[4:8]
                                encrypted_data = data[8:8+payload_len]
                            elif payload_len == 127:
                                # 大负载长度处理
                                payload_len = (data[2] << 56) | (data[3] << 48) | (data[4] << 40) | (data[5] << 32) | (data[6] << 24) | (data[7] << 16) | (data[8] << 8) | data[9]
                                print(f"   大负载长度: {payload_len}")
                                mask = data[10:14]
                                encrypted_data = data[14:14+payload_len]
                            else:
                                mask = data[2:6]
                                encrypted_data = data[6:6+payload_len]
                            
                            print(f"   掩码: {mask}")
                            print(f"   加密数据: {encrypted_data}")
                            
                            # 解密数据
                            decoded = bytearray()
                            for i in range(payload_len):
                                decoded.append(encrypted_data[i] ^ mask[i % 4])
                            
                            try:
                                decoded_str = decoded.decode()
                                print(f"   解密后数据: {decoded_str}")
                                
                                message = json.loads(decoded_str)
                                print("📩 解析后的WebSocket消息:", message)
                                
                                # 处理消息
                                handle_message(message)
                                
                                # 发送确认
                                response = json.dumps({"status": "received", "type": message.get("type")})
                                print(f"📤 发送确认消息: {response}")
                                send_websocket_message(client_socket, response)
                            except Exception as e:
                                print("❌ 解析消息失败:", e, "原始数据:", decoded)
                                # 发送错误确认
                                response = json.dumps({"status": "error", "type": "parse_error"})
                                send_websocket_message(client_socket, response)
                            
                    except Exception as e:
                        print("处理消息时出错:", e)
                        # 移除traceback模块的使用，以提高MicroPython兼容性
                        break
                        
            else:
                # 普通HTTP请求
                print("收到HTTP请求")
                print("请求内容:", request)
                
                try:
                    if "/ping" in request:
                        # 处理/ping端点请求
                        print("处理/ping请求")
                        response = "HTTP/1.1 200 OK\r\n"
                        response += "Content-Type: application/json\r\n"
                        response += "Access-Control-Allow-Origin: *\r\n"
                        response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                        response += "Access-Control-Allow-Headers: *\r\n\r\n"
                        response += '{"status": "online", "message": "ESP32在线"}'
                        print("发送/ping响应:", response)
                        client_socket.send(response.encode())
                    elif "/led/" in request:
                        # 处理LED控制请求
                        print("处理LED请求")
                        response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
                        response += '{"status": "ok", "message": "LED命令已接收"}'
                        
                        led_status = ""
                        # 这里可以添加实际的LED控制代码
                        if "/led/green" in request:
                            led_status = "绿色"
                            print("LED: 绿色")
                        elif "/led/yellow" in request:
                            led_status = "黄色"
                            print("LED: 黄色")
                        elif "/led/off" in request:
                            led_status = "关闭"
                            print("LED: 关闭")
                        elif "/led/rainbow" in request:
                            led_status = "彩虹模式"
                            print("LED: 彩虹模式")
                        
                        # 更新OLED显示LED状态
                        if OLED_INITIALIZED and led_status:
                            try:
                                oled.fill(0)
                                oled.text("LED控制", 0, 0)
                                oled.text(f"状态: {led_status}", 0, 20)
                                oled.text("来自前端", 0, 40)
                                oled.show()
                                print("✅ 更新OLED显示LED状态")
                            except Exception as e:
                                print("❌ LED状态显示失败:", e)
                        
                        client_socket.send(response.encode())
                    elif "OPTIONS" in request:
                        # 处理CORS预检请求
                        print("处理OPTIONS请求")
                        response = "HTTP/1.1 200 OK\r\n"
                        response += "Access-Control-Allow-Origin: *\r\n"
                        response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                        response += "Access-Control-Allow-Headers: *\r\n\r\n"
                        client_socket.send(response.encode())
                    else:
                        # 其他HTTP请求
                        print("处理其他HTTP请求")
                        response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n"
                        response += "<h1>ESP32 Focus Timer</h1><p>WebSocket服务运行中</p>"
                        client_socket.send(response.encode())
                except Exception as e:
                    print("HTTP请求处理错误:", e)
                    client_socket.send(b"HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\nServer Error")
                
            client_socket.close()
            
        except Exception as e:
            print("服务器错误:", e)
            time.sleep(1)

# 发送WebSocket消息
def send_websocket_message(socket, message):
    try:
        # 检查message是否已经是字符串
        if isinstance(message, str):
            data = message
        else:
            data = json.dumps(message)
        data_bytes = data.encode()
        
        # 简单的WebSocket帧
        frame = bytearray()
        frame.append(0x81)  # FIN + 文本帧
        if len(data_bytes) < 126:
            frame.append(len(data_bytes))
        else:
            frame.append(126)
            frame.append((len(data_bytes) >> 8) & 255)
            frame.append(len(data_bytes) & 255)
        
        frame.extend(data_bytes)
        socket.send(frame)
        print("发送WebSocket消息:", message)
    except Exception as e:
        print("发送WebSocket消息错误:", e)

# 处理收到的消息
def handle_message(message):
    global remaining_seconds, current_state, is_paused, focus_duration, is_break
    print("📩 收到消息:", message)
    
    # 确保message是一个字典
    if not isinstance(message, dict):
        print("❌ 消息不是字典类型:", type(message))
        return
        
    msg_type = message.get("type")
    print(f"🔍 解析消息类型: {msg_type}")
    
    if msg_type == "start":
        # 优先使用前端发送的totalSeconds，确保与前端同步
        total_seconds = message.get("totalSeconds", 25 * 60)  # 默认25分钟
        duration = message.get("duration", total_seconds // 60)
        
        print(f"⏰ 开始专注命令: {duration}分钟 (总秒数: {total_seconds})")
        
        # 确保total_seconds是数字
        if isinstance(total_seconds, (int, float)):
            duration_minutes = total_seconds / 60  # 转换为分钟，因为start_focus函数接受分钟数
            start_focus(duration_minutes)
        else:
            try:
                total_seconds_num = float(total_seconds)
                duration_minutes = total_seconds_num / 60
                start_focus(duration_minutes)
            except ValueError:
                print(f"❌ 无法将totalSeconds转换为数字: {total_seconds}")
            except Exception as e:
                print(f"❌ 调用start_focus时出错: {e}")
        
        print(f"📋 专注开始后状态: 当前状态={current_state}, 总时长={focus_duration}秒, 剩余时间={remaining_seconds}秒")
        
    elif msg_type == "pause":
        print("⏸️  暂停专注命令")
        pause_focus()
        print("✅ 调用pause_focus函数成功")
        
    elif msg_type == "resume":
        print("▶️  继续专注命令")
        resume_focus()
        print("✅ 调用resume_focus函数成功")
        
    elif msg_type == "stop":
        print("⏹️  停止专注命令")
        stop_focus()
        print("✅ 调用stop_focus函数成功")
        
    elif msg_type == "progress":
        remaining = message.get("remainingSeconds", 0)
        progress_pct = message.get("progressPercent", 0)
        print(f"📊 收到专注进度更新 - 剩余: {remaining}秒, 进度: {progress_pct}%")
        if remaining > 0:
            remaining_seconds = remaining
            # 如果收到进度更新，确保状态是running且未暂停
            current_state = "running"
            is_paused = False
            is_break = False
            display_timer()
            print(f"   已更新专注剩余时间为: {remaining_seconds}秒")
            print(f"   当前状态: {current_state}, 暂停状态: {is_paused}, 休息模式: {is_break}")
            
    elif msg_type == "complete":
        print("🎉 完成专注命令")
        complete_focus()
        print("✅ 调用complete_focus函数成功")
        
    # 休息相关命令处理
    elif msg_type == "break_start":
        # 开始休息
        break_total_seconds = message.get("totalSeconds", 5 * 60)  # 默认5分钟
        break_duration = message.get("duration", break_total_seconds // 60)
        
        print(f"⏰ 开始休息命令: {break_duration}分钟 (总秒数: {break_total_seconds})")
        
        # 确保total_seconds是数字
        if isinstance(break_total_seconds, (int, float)):
            global focus_duration, remaining_seconds, current_state, is_paused, is_break
            focus_duration = int(break_total_seconds)
            remaining_seconds = focus_duration
            current_state = "break_running"
            is_paused = False
            is_break = True
            
            display_timer()
            print(f"📋 休息开始后状态: 当前状态={current_state}, 总时长={focus_duration}秒, 剩余时间={remaining_seconds}秒")
        else:
            try:
                break_total_seconds_num = float(break_total_seconds)
                focus_duration = int(break_total_seconds_num)
                remaining_seconds = focus_duration
                current_state = "break_running"
                is_paused = False
                is_break = True
                
                display_timer()
                print(f"📋 休息开始后状态: 当前状态={current_state}, 总时长={focus_duration}秒, 剩余时间={remaining_seconds}秒")
            except ValueError:
                print(f"❌ 无法将break_totalSeconds转换为数字: {break_total_seconds}")
            except Exception as e:
                print(f"❌ 处理break_start命令时出错: {e}")
                
    elif msg_type == "break_progress":
        # 休息进度更新
        remaining = message.get("remainingSeconds", 0)
        progress_pct = message.get("progressPercent", 0)
        print(f"📊 收到休息进度更新 - 剩余: {remaining}秒, 进度: {progress_pct}%")
        if remaining > 0:
            remaining_seconds = remaining
            # 如果收到进度更新，确保状态是break_running且未暂停
            current_state = "break_running"
            is_paused = False
            is_break = True
            display_timer()
            print(f"   已更新休息剩余时间为: {remaining_seconds}秒")
            print(f"   当前状态: {current_state}, 暂停状态: {is_paused}, 休息模式: {is_break}")
            
    elif msg_type == "break_pause":
        # 暂停休息
        print("⏸️  暂停休息命令")
        global pause_remaining
        if current_state == "break_running":
            is_paused = True
            current_state = "break_paused"
            pause_remaining = remaining_seconds
            display_timer()
            print(f"✅ 已暂停休息，剩余: {pause_remaining}秒")
            
    elif msg_type == "break_resume":
        # 继续休息
        print("▶️  继续休息命令")
        if current_state == "break_paused":
            is_paused = False
            current_state = "break_running"
            display_timer()
            print("✅ 已继续休息")
            
    elif msg_type == "break_complete":
        # 完成休息
        print("🎉 完成休息命令")
        complete_break()
        print("✅ 调用complete_break函数成功")
        
    elif msg_type == "status":
        # 状态查询
        print("📡 收到状态查询消息")
        if OLED_INITIALIZED:
            try:
                oled.fill(0)
                oled.text("设备在线", 20, 20)
                oled.text("等待指令", 5, 35)
                oled.show()
                print("✅ 更新OLED状态显示")
            except Exception as e:
                print("❌ 状态查询显示失败:", e)
    else:
        print(f"❓ 未知消息类型: {msg_type}")

# 主程序
if __name__ == "__main__":
    try:
        start_websocket_server()
    except KeyboardInterrupt:
        print("程序结束")
    except Exception as e:
        print("错误:", e)
        # 重启
        time.sleep(5)
        import machine
        machine.reset()