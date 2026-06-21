pipeline {

agent any

environment {
    FRONTEND_IMAGE = "frontend"
    BACKEND_IMAGE = "backend"
    TAG = "${BUILD_NUMBER}"
    SCANNER_HOME = tool 'sonar-scanner'
}

stages {

    stage('Checkout') {
        steps {
            checkout scm
            sh 'mkdir -p reports'
        }
    }

    stage('Gitleaks Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                gitleaks detect \
                --source . \
                --report-format json \
                --report-path reports/gitleaks-report.json
                '''
            }
        }
    }

    stage('Trivy Filesystem Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                trivy fs . \
                --format json \
                --output reports/trivy-fs-report.json
                '''
            }
        }
    }

    stage('Detect Language') {
        steps {
            script {

                if (fileExists('Application-Code/backend/pom.xml')) {
                    env.APP_LANG = "java"
                }
                else if (fileExists('Application-Code/backend/package.json')) {
                    env.APP_LANG = "nodejs"
                }
                else if (fileExists('Application-Code/backend/requirements.txt')) {
                    env.APP_LANG = "python"
                }
                else if (fileExists('Application-Code/backend/go.mod')) {
                    env.APP_LANG = "golang"
                }
                else {
                    error("Unsupported Language")
                }

                echo "Detected Language: ${env.APP_LANG}"
            }
        }
    }

    stage('Backend Build') {
        steps {
            script {

                switch(env.APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn clean package -DskipTests'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh '''
                            npm install
                            npm run build
                            '''
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            python3 -m venv venv
                            . venv/bin/activate
                            pip install -r requirements.txt
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go build ./...'
                        }
                        break
                }
            }
        }
    }

    stage('Frontend Build') {

        when {
            expression {
                fileExists('Application-Code/frontend/package.json')
            }
        }

        steps {

            dir('Application-Code/frontend') {

                sh '''
                export NODE_OPTIONS=--openssl-legacy-provider
                npm install
                npm run build
                '''
            }
        }
    }

    stage('Unit Tests') {

        steps {

            script {

                switch(env.APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn test'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh 'npm test || true'
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            . venv/bin/activate
                            pytest || true
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go test ./... || true'
                        }
                        break
                }
            }
        }
    }

    stage('SonarQube Scan') {

        steps {

            withSonarQubeEnv('sonar') {

                script {

                    switch(env.APP_LANG) {

                        case "java":
                            dir('Application-Code/backend') {
                                sh '''
                                mvn sonar:sonar \
                                -Dsonar.projectKey=backend
                                '''
                            }
                            break

                        case "nodejs":
                            dir('Application-Code/backend') {
                                sh """
                                ${SCANNER_HOME}/bin/sonar-scanner \
                                -Dsonar.projectKey=backend \
                                -Dsonar.sources=. \
                                -Dsonar.sourceEncoding=UTF-8
                                """
                            }
                            break

                        case "python":
                            dir('Application-Code/backend') {
                                sh """
                                ${SCANNER_HOME}/bin/sonar-scanner \
                                -Dsonar.projectKey=backend \
                                -Dsonar.sources=.
                                """
                            }
                            break

                        case "golang":
                            dir('Application-Code/backend') {
                                sh """
                                ${SCANNER_HOME}/bin/sonar-scanner \
                                -Dsonar.projectKey=backend \
                                -Dsonar.sources=.
                                """
                            }
                            break
                    }
                }
            }
        }
    }

    stage('Quality Gate') {

        steps {

            timeout(time: 10, unit: 'MINUTES') {

                waitForQualityGate abortPipeline: false
            }
        }
    }

    stage('Build Frontend Image') {

        when {
            expression {
                fileExists('Application-Code/frontend/Dockerfile')
            }
        }
        steps {
            sh """
            docker build \
            -t ${FRONTEND_IMAGE}:${TAG} \
            -f Application-Code/frontend/Dockerfile \
            Application-Code/frontend
            """
        }
    }

    
    

    stage('Build Backend Image') {

        when {
            expression {
                fileExists('Application-Code/backend/Dockerfile')
            }
        }

        steps {
            sh """
            docker build \
            -t ${BACKEND_IMAGE}:${TAG} \
            -f Application-Code/backend/Dockerfile \
            Application-Code/backend
            """
        }
    }
    

    stage('Trivy Image Scan') {

        steps {

            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {

                sh """
                mkdir -p reports
                trivy image --format json --output reports/trivy-frontend-image-report.json ${FRONTEND_IMAGE}:${TAG}
                trivy image --format json --output reports/trivy-backend-image-report.json ${BACKEND_IMAGE}:${TAG}
                """
            }
        }
    }

    
    
    stage('Push Docker Images to Nexus') {

        steps {

            withCredentials([
                usernamePassword(
                    credentialsId: 'nexus-cred',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )
            ]) {

               sh '''
                echo "$NEXUS_PASS" | docker login localhost:8083 -u "$NEXUS_USER" --password-stdin

                # ---------------- FRONTEND ----------------
                docker tag frontend:${TAG} localhost:8083/three-tier-app/frontend:${TAG}
                docker push localhost:8083/three-tier-app/frontend:${TAG}

                # ---------------- BACKEND ----------------
                docker tag backend:${TAG} localhost:8083/three-tier-app/backend:${TAG}
                docker push localhost:8083/three-tier-app/backend:${TAG}
                
                # Remove local tags
                docker rmi frontend:${TAG} || true
                docker rmi backend:${TAG} || true   
                docker rmi localhost:8083/three-tier-app/frontend:${TAG} || true
                docker rmi localhost:8083/three-tier-app/backend:${TAG} || true
                '''
            }
        }
    }
} 

    

post {
    always {

        archiveArtifacts(
            artifacts: '''
            reports/**/*,
            **/target/*.jar,
            **/target/surefire-reports/**/*,
            **/dist/**/*,
            **/build/**/*,
            **/*.log
            '''.trim(),

            excludes: '''
            **/node_modules/**,
            **/Application-Code/**/node_modules/**,
            **/.npm/**,
            **/.cache/**
            '''.trim(),

            fingerprint: true,
            allowEmptyArchive: true
        )

        cleanWs notFailBuild: true
    }

    success {
        echo 'Pipeline Success'
    }

    unstable {
        echo 'Pipeline Completed With Security Findings'
    }

    failure {
        echo 'Pipeline Failed'
    }
}

}
