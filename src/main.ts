// 入口：Task 8 临时接线减数分裂课程验证装配；Task 9 将替换为正式路由与课程注册表
import "./style.css";
import { mountCoursePage } from "./core/app";
import { meiosisCourse } from "./courses/meiosis/data";
import { createMeiosisScene } from "./courses/meiosis/scene";

const root = document.getElementById("app")!;
mountCoursePage(root, meiosisCourse, createMeiosisScene);
