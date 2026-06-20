import { AppExperience } from "../../app-experience";

export const metadata = {
  title: "学生画面デモ | Manalio",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoStudentPage() {
  return (
    <>
      <div className="public-demo-route-note">
        このデモは架空の実習場面で試せます。実名・実習先名は入れないでください。学生画面の流れを確認できます。外部AI APIや学校データ保存は使いません。
      </div>
      <AppExperience publicDemoRole="student" publicDemoReturnHref="/demo" />
    </>
  );
}
